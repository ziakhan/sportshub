import { env } from "./env"

/**
 * Push fan-out worker (M3 — docs/roadmap/native-app-execution-plan.md).
 *
 * The web app enqueues fully-written notifications ({userId, title, body});
 * this module owns everything device-side: resolve Device rows, apply the
 * user's quiet hours (wall time in APP_TIMEZONE), chunk to the Expo Push
 * API, and prune devices Expo reports as DeviceNotRegistered — both from
 * immediate tickets and from the delayed receipt check (Expo only knows an
 * iOS token died when APNs tells it, which arrives with the receipt).
 *
 * Pure helpers are exported for unit tests; IO goes through `PushDeps` so
 * tests inject fakes.
 */

export interface PushItem {
  userId: string
  type: string
  title: string
  message: string
  link?: string | null
}

export interface DeviceRow {
  token: string
  userId: string
}

export interface QuietWindow {
  start: string | null
  end: string | null
}

/** Overridable for local verification against a mock Expo server. */
export const EXPO_PUSH_URL =
  process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send"
export const EXPO_RECEIPTS_URL =
  process.env.EXPO_RECEIPTS_URL || "https://exp.host/--/api/v2/push/getReceipts"
export const EXPO_CHUNK_SIZE = 100
/** Expo asks for a delay before receipts are ready; 15 min is their guidance. */
export const RECEIPT_DELAY_MS = 15 * 60 * 1000

/** Minutes since local midnight in `timeZone` for the given instant. */
export function wallMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  // en-GB renders midnight as "00" — no 24:00 wrinkle to handle
  return get("hour") * 60 + get("minute")
}

function parseHHMM(value: string | null): number | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null
}

/**
 * Is `nowMinutes` inside the quiet window? Windows may wrap midnight
 * (22:00 → 08:00). Unset/invalid/zero-length windows are never quiet.
 */
export function inQuietHours(nowMinutes: number, window: QuietWindow): boolean {
  const start = parseHHMM(window.start)
  const end = parseHHMM(window.end)
  if (start === null || end === null || start === end) return false
  if (start < end) return nowMinutes >= start && nowMinutes < end
  return nowMinutes >= start || nowMinutes < end
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data: { link: string | null; type: string }
  sound: "default"
}

/**
 * Cross product of items × the sender's devices, minus quiet-hours users.
 * Pure — the worker resolves rows first, tests feed them directly.
 */
export function buildMessages(
  items: PushItem[],
  devices: DeviceRow[],
  quietByUser: Map<string, QuietWindow>,
  nowMinutes: number
): { messages: ExpoPushMessage[]; skippedQuiet: number } {
  const devicesByUser = new Map<string, DeviceRow[]>()
  for (const d of devices) {
    const list = devicesByUser.get(d.userId) ?? []
    list.push(d)
    devicesByUser.set(d.userId, list)
  }

  const messages: ExpoPushMessage[] = []
  let skippedQuiet = 0
  for (const item of items) {
    const quiet = quietByUser.get(item.userId)
    if (quiet && inQuietHours(nowMinutes, quiet)) {
      skippedQuiet++
      continue
    }
    for (const device of devicesByUser.get(item.userId) ?? []) {
      messages.push({
        to: device.token,
        title: item.title,
        body: item.message,
        data: { link: item.link ?? null, type: item.type },
        sound: "default",
      })
    }
  }
  return { messages, skippedQuiet }
}

interface ExpoTicket {
  status: "ok" | "error"
  id?: string
  message?: string
  details?: { error?: string }
}

/** Tokens to revoke + receipt-id→token map, from one send response. */
export function foldTickets(
  tickets: ExpoTicket[],
  sentTokens: string[]
): { revokeTokens: string[]; receiptMap: Record<string, string> } {
  const revokeTokens: string[] = []
  const receiptMap: Record<string, string> = {}
  tickets.forEach((ticket, i) => {
    const token = sentTokens[i]
    if (!token) return
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      revokeTokens.push(token)
    } else if (ticket.status === "ok" && ticket.id) {
      receiptMap[ticket.id] = token
    }
  })
  return { revokeTokens, receiptMap }
}

/** Prisma surface the worker needs — kept narrow so tests can fake it. */
export interface PushDb {
  device: {
    findMany(args: unknown): Promise<DeviceRow[]>
    updateMany(args: unknown): Promise<unknown>
  }
  user: {
    findMany(args: unknown): Promise<{ id: string; pushQuietStart: string | null; pushQuietEnd: string | null }[]>
  }
}

export interface PushDeps {
  db: PushDb
  fetchFn: typeof fetch
  now: () => Date
  /** Schedule the receipt check; the queue provides the delay mechanics. */
  scheduleReceipts: (receiptMap: Record<string, string>) => Promise<void>
}

async function revokeTokens(db: PushDb, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return
  await db.device.updateMany({
    where: { token: { in: tokens } },
    data: { revokedAt: new Date() },
  })
}

function expoHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(env.expoAccessToken ? { authorization: `Bearer ${env.expoAccessToken}` } : {}),
  }
}

/** Process one enqueued batch: resolve → filter → send → prune → schedule receipts. */
export async function processSend(items: PushItem[], deps: PushDeps): Promise<{
  sent: number
  skippedQuiet: number
  revoked: number
}> {
  const userIds = [...new Set(items.map((i) => i.userId))]
  const [devices, users] = await Promise.all([
    deps.db.device.findMany({
      where: { userId: { in: userIds }, revokedAt: null },
      select: { token: true, userId: true },
    }),
    deps.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pushQuietStart: true, pushQuietEnd: true },
    }),
  ])
  const quietByUser = new Map(
    users.map((u) => [u.id, { start: u.pushQuietStart, end: u.pushQuietEnd }])
  )

  const nowMinutes = wallMinutes(deps.now(), env.appTimezone)
  const { messages, skippedQuiet } = buildMessages(items, devices, quietByUser, nowMinutes)
  if (messages.length === 0) return { sent: 0, skippedQuiet, revoked: 0 }

  const allRevoke: string[] = []
  const allReceipts: Record<string, string> = {}
  for (const batch of chunk(messages, EXPO_CHUNK_SIZE)) {
    const res = await deps.fetchFn(EXPO_PUSH_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      // Whole-request failure (rate limit, outage): BullMQ retries the job.
      throw new Error(`expo push send failed: ${res.status}`)
    }
    const payload = (await res.json()) as { data?: ExpoTicket[] }
    const { revokeTokens: bad, receiptMap } = foldTickets(
      payload.data ?? [],
      batch.map((m) => m.to)
    )
    allRevoke.push(...bad)
    Object.assign(allReceipts, receiptMap)
  }

  await revokeTokens(deps.db, allRevoke)
  if (Object.keys(allReceipts).length > 0) await deps.scheduleReceipts(allReceipts)
  return { sent: messages.length, skippedQuiet, revoked: allRevoke.length }
}

/** Delayed pass: ask Expo what actually happened, prune dead devices. */
export async function processReceipts(
  receiptMap: Record<string, string>,
  deps: Pick<PushDeps, "db" | "fetchFn">
): Promise<{ revoked: number }> {
  const ids = Object.keys(receiptMap)
  const toRevoke: string[] = []
  for (const idBatch of chunk(ids, 300)) {
    const res = await deps.fetchFn(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({ ids: idBatch }),
    })
    if (!res.ok) throw new Error(`expo receipts failed: ${res.status}`)
    const payload = (await res.json()) as {
      data?: Record<string, { status: string; details?: { error?: string } }>
    }
    for (const [id, receipt] of Object.entries(payload.data ?? {})) {
      if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
        const token = receiptMap[id]
        if (token) toRevoke.push(token)
      }
    }
  }
  await revokeTokens(deps.db, toRevoke)
  return { revoked: toRevoke.length }
}
