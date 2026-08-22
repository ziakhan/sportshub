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
 * ── THREE READINGS, NOT TWO (owner, 2026-08-21) ───────────────────────────
 * "Not live" is two completely different sentences and this probe used to say
 * the wrong one. Cloudflare answers a live input that exists but has no
 * broadcast arriving with HTTP 204 and an empty body, and reading that as "not
 * an HLS manifest" sent the owner hunting for a broken URL when the only thing
 * missing was somebody pressing Go Live on the camera. So:
 *
 *   live   a manifest is being written right now
 *   idle   the address answered and there is simply no broadcast on it
 *          (204, any empty 2xx, or a playlist closed with #EXT-X-ENDLIST)
 *   fault  we could not get a picture AND cannot say the address is fine
 *          (404/410, 401/403, junk instead of a manifest, unreachable)
 *
 * Idle is a NORMAL state: a camera in a locked gym at 3pm is idle and nobody
 * needs to be told. The surfaces decide how loudly to say it — the console
 * only shouts when a channel is not live WITH a game in its window.
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

/**
 * What one probe saw. `idle` is not a failure: see the header note.
 */
export type SignalState = "live" | "idle" | "fault"

export interface ProbeVerdict {
  state: SignalState
  /** Why it is not live, in words an operator can act on. Null when live. */
  detail: string | null
}

export interface ChannelHealth {
  id: string
  name: string
  /** The manifest answered and looks like a running live playlist. */
  live: boolean
  /** live / idle / fault. `live === (state === "live")`, always. */
  state: SignalState
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

/* ── the sentences ─────────────────────────────────────────────────────────
 * One place, because every one of them is read by a person standing in a gym
 * deciding what to go and touch. Plain words, no vendor jargon, and each one
 * names the next action where there is one.
 */

/** 204, or any 2xx that carries nothing. The address is fine; nobody is on it. */
const IDLE_DETAIL = "No broadcast arriving. Start the camera pointed at this stream key."

/** A playlist that closed itself. The rig WAS pushing and has stopped. */
const ENDED_DETAIL = "The last broadcast ended, so nothing is arriving on this address now."

/** 200 with a body that is not a playlist: someone pasted the wrong address. */
const NOT_A_MANIFEST_DETAIL =
  "That address answered with something that is not an HLS manifest, so the playback URL is pointing at the wrong thing."

/**
 * 404/410. Verified 2026-08-21 against Cloudflare's edge: an unknown input UID
 * under a real customer code answers `404 NotFound: failed to fetch`, and an
 * unknown customer code answers a plain `404 not found`. A self-hosted origin
 * (MediaMTX) 404s the same way while its camera is simply off, so this sentence
 * carries both readings rather than picking one.
 */
const NOTHING_PUBLISHED_DETAIL =
  "Nothing is published at that address. Either the camera has never gone live on it, or the playback URL is wrong."

/**
 * 401/403. NOT verified against a real idle Cloudflare input (no live input was
 * reachable from this machine), so the wording stays honest about both readings
 * instead of asserting one. It is only ever reached when the ranged GET refuses
 * too — a HEAD-only 403 falls through, because plenty of origins allow GET and
 * refuse HEAD, and calling a working camera broken is the worse mistake.
 */
function refusedDetail(status: number): string {
  return `The stream host refused the request (${status}). That address may need a signed token, or the camera may not have gone live on it yet.`
}

/**
 * What the manifest body says. A 200 alone is not proof of a picture: some
 * origins keep serving the last playlist after the encoder quits, and that
 * playlist carries #EXT-X-ENDLIST, which is the vendor saying "this is over".
 *
 * An EMPTY 2xx body is the same statement as a 204 and is read as idle, not as
 * a malformed manifest.
 */
function readManifest(body: string): ProbeVerdict {
  const text = body.trim()
  if (text === "") return { state: "idle", detail: IDLE_DETAIL }
  if (!text.includes("#EXTM3U")) return { state: "fault", detail: NOT_A_MANIFEST_DETAIL }
  if (text.includes("#EXT-X-ENDLIST")) return { state: "idle", detail: ENDED_DETAIL }
  return { state: "live", detail: null }
}

/**
 * What an HTTP status alone settles. `null` means "this status does not settle
 * it" — keep going and let the ranged GET's body decide.
 */
function readStatus(status: number, from: "head" | "get"): ProbeVerdict | null {
  // The whole defect: an idle live input, not a broken address.
  if (status === 204) return { state: "idle", detail: IDLE_DETAIL }
  if (status === 404 || status === 410) return { state: "fault", detail: NOTHING_PUBLISHED_DETAIL }
  // A refusal is only believed when the GET says it too (see refusedDetail).
  if (status === 401 || status === 403) {
    return from === "get" ? { state: "fault", detail: refusedDetail(status) } : null
  }
  // Origins that only implement GET. The GET answers the question.
  if (status === 405 || status === 501) return null
  if (status >= 200 && status < 300) return null
  return { state: "fault", detail: `The playback URL answered ${status}` }
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
export async function probeChannel(channel: ProbeableChannel): Promise<ProbeVerdict> {
  let url: URL
  try {
    url = new URL(channel.playbackUrl)
  } catch {
    return { state: "fault", detail: "The playback URL is not a valid address" }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { state: "fault", detail: "The playback URL is not http or https" }
  }

  const headers = { "cache-control": "no-cache" }

  try {
    const head = await fetch(url, {
      method: "HEAD",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    const settled = readStatus(head.status, "head")
    if (settled) return settled
  } catch (error) {
    return { state: "fault", detail: describeFetchError(error) }
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...headers, range: `bytes=0-${PROBE_BYTES - 1}` },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    const settled = readStatus(res.status, "get")
    if (settled) return settled
    if (!res.ok && res.status !== 206) {
      return { state: "fault", detail: `The playback URL answered ${res.status}` }
    }
    const body = (await res.text()).slice(0, PROBE_BYTES)
    return readManifest(body)
  } catch (error) {
    return { state: "fault", detail: describeFetchError(error) }
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
        const { state, detail } = await probeChannel(channel)
        const live = state === "live"
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
          state,
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
