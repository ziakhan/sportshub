import { prisma } from "@youthbasketballhub/db"

/**
 * Live streaming — the signal health probe
 * (docs/roadmap/live-streaming-plan.md, phase 2: "health probe cron").
 *
 * The platform never talks to cameras. The one thing it CAN ask, cheaply and
 * from anywhere, is whether a channel's HLS manifest is being written right
 * now: an encoder that stopped pushing leaves a playlist that 404s (MediaMTX,
 * most self-hosted origins) or goes stale and closes with #EXT-X-ENDLIST.
 *
 * So "is Camera B alive?" is answered by fetching its playbackUrl and reading
 * the first couple of kilobytes. A success stamps `lastSeenLiveAt`, and that
 * column is the whole point: the ops dashboard does not need the probe to have
 * just run to paint a channel red, it only needs to know how long it has been
 * since the channel last looked alive.
 *
 * ── ONE-WAY STAMP ─────────────────────────────────────────────────────────
 * A failed probe NEVER clears `lastSeenLiveAt`. The column means "last time we
 * saw a picture", not "state of the last probe" — a transient CDN blip must
 * not erase the fact that the rig was fine 20 seconds ago. Staleness is a
 * reading of the timestamp (isSignalFresh below), not a stored flag.
 *
 * ── SECRETS ───────────────────────────────────────────────────────────────
 * Only `playbackUrl` is ever fetched. ingestUrl/streamKey are what a camera
 * pushes WITH; this module has no reason to touch them and does not select
 * them (see the header rule in lib/queries/game-stream.ts).
 */

/** A probe that has not answered in this long is a dead probe, not a slow one. */
const PROBE_TIMEOUT_MS = 4_000

/** Enough of a manifest to see the tag line and an #EXT-X-ENDLIST if present. */
const PROBE_BYTES = 2_048

/** How many rigs we probe at once. Small pool, small blast radius. */
const PROBE_CONCURRENCY = 6

/**
 * How long a stamp stays believable. An HLS media playlist is rewritten every
 * segment (2-6s typical), so a minute and a half of silence is already several
 * missed rewrites — comfortably past a hiccup, well short of nagging.
 */
export const SIGNAL_FRESH_MS = 90_000

/** Green or red on the dashboard: has this rig looked alive recently? */
export function isSignalFresh(lastSeenLiveAt: Date | string | null, now: Date = new Date()): boolean {
  if (!lastSeenLiveAt) return false
  const seen = lastSeenLiveAt instanceof Date ? lastSeenLiveAt : new Date(lastSeenLiveAt)
  if (Number.isNaN(seen.getTime())) return false
  return now.getTime() - seen.getTime() <= SIGNAL_FRESH_MS
}

export interface ChannelHealth {
  id: string
  name: string
  /** The manifest answered and looks like a running live playlist. */
  live: boolean
  /** When this probe ran (not when the channel was last alive). */
  checkedAt: string
  /** Last time ANY probe saw a picture, after this one's stamp. */
  lastSeenLiveAt: string | null
  /** Why it is not live, in words an operator can act on. */
  detail: string | null
}

/** The channel fields a probe needs. Deliberately no secrets. */
export interface ProbeableChannel {
  id: string
  name: string
  playbackUrl: string
}

/**
 * What the manifest body says. A 200 alone is not proof of a picture: some
 * origins keep serving the last playlist after the encoder quits, and that
 * playlist carries #EXT-X-ENDLIST, which is the vendor saying "this is over".
 */
function readManifest(body: string): { ok: boolean; detail: string | null } {
  if (!body.includes("#EXTM3U")) {
    return { ok: false, detail: "That URL answered, but it is not an HLS manifest" }
  }
  if (body.includes("#EXT-X-ENDLIST")) {
    return { ok: false, detail: "The manifest is closed, so the rig has stopped pushing" }
  }
  return { ok: true, detail: null }
}

/**
 * Ask one channel whether it is pushing a picture.
 *
 * HEAD first because it is the cheapest question a CDN can answer, and a
 * missing playlist (the normal "camera is off" case) 404s on HEAD just as it
 * does on GET. A HEAD that is refused outright (405/501, common on origins
 * that only implement GET) falls through to a ranged GET, which is also what
 * confirms the body when the head looked fine.
 *
 * Never throws: a probe failure is a reading, not an error.
 */
export async function probeChannel(
  channel: ProbeableChannel
): Promise<{ live: boolean; detail: string | null }> {
  let url: URL
  try {
    url = new URL(channel.playbackUrl)
  } catch {
    return { live: false, detail: "The playback URL is not a valid address" }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { live: false, detail: "The playback URL is not http or https" }
  }

  const headers = { "cache-control": "no-cache" }

  try {
    const head = await fetch(url, {
      method: "HEAD",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    // 404/410 is the normal shape of "nothing is being published right now".
    if (head.status === 404 || head.status === 410) {
      return { live: false, detail: "No manifest at that URL right now" }
    }
    if (!head.ok && head.status !== 405 && head.status !== 501) {
      return { live: false, detail: `The playback URL answered ${head.status}` }
    }
  } catch (error) {
    return { live: false, detail: describeFetchError(error) }
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...headers, range: `bytes=0-${PROBE_BYTES - 1}` },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!res.ok && res.status !== 206) {
      return { live: false, detail: `The playback URL answered ${res.status}` }
    }
    const body = (await res.text()).slice(0, PROBE_BYTES)
    const verdict = readManifest(body)
    return { live: verdict.ok, detail: verdict.detail }
  } catch (error) {
    return { live: false, detail: describeFetchError(error) }
  }
}

function describeFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "The playback URL did not answer in time"
    }
    if (error.name === "TypeError") return "Could not reach the playback URL"
  }
  return "Could not reach the playback URL"
}

/**
 * Probe channels and stamp the ones that answered.
 *
 * Callers: the ops dashboard (on load and on "Check signal"), and — once this
 * is deployed — a scheduled job. The cron route that should call it is
 * `apps/web/src/app/api/cron/stream-health/route.ts`; it does not exist yet
 * because wiring a schedule is deploy-time work and this whole lane is local
 * only. When it is added it should be one call to this function with no
 * arguments, on a ~60s cadence during game hours, and it needs nothing else:
 * the stamping and the staleness reading both live here.
 */
export async function probeChannels(
  opts: { channelIds?: string[]; now?: Date } = {}
): Promise<ChannelHealth[]> {
  const now = opts.now ?? new Date()

  const channels = await prisma.streamChannel.findMany({
    where: {
      status: "ACTIVE",
      ...(opts.channelIds?.length ? { id: { in: opts.channelIds } } : {}),
    },
    select: { id: true, name: true, playbackUrl: true, lastSeenLiveAt: true },
    orderBy: { name: "asc" },
  })

  const results: ChannelHealth[] = []

  for (let i = 0; i < channels.length; i += PROBE_CONCURRENCY) {
    const batch = channels.slice(i, i + PROBE_CONCURRENCY)
    const probed = await Promise.all(
      batch.map(async (channel) => {
        const { live, detail } = await probeChannel(channel)
        let lastSeenLiveAt = channel.lastSeenLiveAt
        if (live) {
          // One-way: only a success writes. See the header note.
          try {
            const updated = await prisma.streamChannel.update({
              where: { id: channel.id },
              data: { lastSeenLiveAt: now },
              select: { lastSeenLiveAt: true },
            })
            lastSeenLiveAt = updated.lastSeenLiveAt
          } catch (error) {
            // A channel deleted mid-probe must not fail the whole sweep.
            console.error("stream health: could not stamp", channel.id, error)
            lastSeenLiveAt = now
          }
        }
        const health: ChannelHealth = {
          id: channel.id,
          name: channel.name,
          live,
          checkedAt: now.toISOString(),
          lastSeenLiveAt: lastSeenLiveAt ? lastSeenLiveAt.toISOString() : null,
          detail,
        }
        return health
      })
    )
    results.push(...probed)
  }

  return results
}
