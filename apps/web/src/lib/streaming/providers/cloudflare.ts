import {
  DEFAULT_DELETE_RECORDING_AFTER_DAYS,
  DEFAULT_RECORDING_MODE,
  MAX_DELETE_RECORDING_AFTER_DAYS,
  MIN_DELETE_RECORDING_AFTER_DAYS,
  StreamProviderError,
  type CreateChannelOptions,
  type ProvisionedChannel,
  type StreamProvider,
} from "./types"

/**
 * Cloudflare Stream Live — option B in docs/roadmap/live-streaming-plan.md.
 *
 * One POST creates a "live input", which is exactly our channel: a permanent
 * RTMPS ingest pair and a permanent HLS playback URL that goes live whenever
 * the camera pushes. Nothing here is ever called again for the life of the
 * rig, which is why the whole vendor surface is this one file.
 *
 * VERIFIED against the live docs + the official TypeScript SDK's `LiveInput`
 * type (2026-08-21). The create response looks like:
 *
 *   {
 *     "result": {
 *       "uid": "f256e6ea9341d51eea64c9454659e576",
 *       "rtmps": { "url": "rtmps://live.cloudflare.com:443/live/",
 *                  "streamKey": "MTQ0MTcjM3M…" },
 *       "rtmpsPlayback": { … }, "srt": { … }, "srtPlayback": { … },
 *       "webRTC":         { "url": "https://customer-<CODE>.cloudflarestream.com/<SECRET>/webRTC/publish" },
 *       "webRTCPlayback": { "url": "https://customer-<CODE>.cloudflarestream.com/<INPUT_UID>/webRTC/play" },
 *       "created": "…", "modified": "…", "meta": { "name": "test stream" },
 *       "status": null, "enabled": true,
 *       "recording": { "mode": "automatic", "requireSignedURLs": false,
 *                      "allowedOrigins": null, "hideLiveViewerCount": false },
 *       "deleteRecordingAfterDays": null
 *     },
 *     "success": true, "errors": [], "messages": []
 *   }
 *
 * THE THING THAT MATTERS: there is NO `.m3u8` anywhere in that response.
 * Cloudflare does not hand back an HLS URL for a live input — you build it as
 * `https://customer-<CODE>.cloudflarestream.com/<UID>/manifest/video.m3u8`.
 * But the customer code is not a secret and it IS in the response, sitting in
 * the host of `webRTCPlayback.url`. So we lift it from there and the
 * CLOUDFLARE_STREAM_CUSTOMER_CODE env var is only a FALLBACK — needed if
 * Cloudflare ever stops returning the WebRTC block, and named explicitly in
 * the error when that happens rather than leaving a broken playback URL.
 *
 * `webRTC.url` (publish) carries a push secret in its path. It is never
 * stored, never logged, and only its hostname is ever read.
 *
 * TWO THINGS A REAL CAMERA TAUGHT US (2026-08-22, live-streaming-plan.md
 * "Field notes from the first real camera"):
 *
 *  1. RECORDING IS NOT OPTIONAL HERE. Cloudflare serves live playback out of
 *     the recording pipeline, so a live input created with `recording.mode`
 *     off accepts the broadcast and never produces a manifest. Nobody ever
 *     sees a picture. That is why the default is "automatic".
 *  2. RECORDINGS ARE BILLED UNTIL SOMEONE DELETES THEM, so every input we
 *     create carries `deleteRecordingAfterDays`. Their minimum is 30 (1 and
 *     7 are refused), and we ask for the minimum.
 */

const API_BASE = "https://api.cloudflare.com/client/v4"

/** A vendor call that hangs is a form that hangs. */
const TIMEOUT_MS = 15_000

/** Reads env at call time, never at import: tests and the box both set it late. */
function config(): { accountId: string; token: string; customerCode: string | null } {
  return {
    accountId: (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim(),
    token: (process.env.CLOUDFLARE_STREAM_TOKEN ?? "").trim(),
    customerCode: (process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "").trim() || null,
  }
}

/** The `customer-<CODE>` label out of any cloudflarestream.com host. */
export function customerCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    const match = /^customer-([a-z0-9]+)\.cloudflarestream\.com$/i.exec(host)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function buildPlaybackUrl(customerCode: string, inputUid: string): string {
  return `https://customer-${customerCode}.cloudflarestream.com/${inputUid}/manifest/video.m3u8`
}

interface CloudflareEnvelope<T> {
  result?: T
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
  messages?: Array<{ code?: number; message?: string }>
}

interface CloudflareLiveInput {
  uid?: string
  rtmps?: { url?: string; streamKey?: string }
  webRTC?: { url?: string }
  webRTCPlayback?: { url?: string }
}

/**
 * Turn a Cloudflare failure into one sentence an operator can act on.
 *
 * Their `errors[].message` is genuinely good ("Stream is not enabled for this
 * account", "Authentication error") and is what the person needs to read, so
 * it is passed through rather than flattened into "provisioning failed". The
 * two failures that will actually happen on day one — no Stream subscription,
 * and a token without Stream:Edit — get a sentence saying what to go and do,
 * because neither is guessable from Cloudflare's wording alone.
 */
function describeFailure(status: number, body: CloudflareEnvelope<unknown> | null): string {
  const vendor = (body?.errors ?? [])
    .map((error) => error?.message?.trim())
    .filter((message): message is string => !!message)
    .join("; ")

  if (status === 401 || status === 403) {
    return `${vendor || "Cloudflare refused the token"}. Check that CLOUDFLARE_STREAM_TOKEN is an API token with the Stream:Edit permission and that CLOUDFLARE_ACCOUNT_ID is the right account.`
  }
  if (status === 404) {
    return `${vendor || "Cloudflare could not find that account"}. Check CLOUDFLARE_ACCOUNT_ID.`
  }
  if (status === 402 || /subscription|billing|not enabled|entitle/i.test(vendor)) {
    return `${vendor || "Cloudflare Stream is not enabled on this account"}. Stream has to be turned on in the Cloudflare dashboard before live inputs can be created.`
  }
  if (vendor) return vendor
  return `Cloudflare answered ${status} with no explanation.`
}

async function callCloudflare<T>(
  path: string,
  init: { method: string; body?: unknown }
): Promise<CloudflareEnvelope<T>> {
  const { accountId, token } = config()

  let response: Response
  try {
    response = await fetch(`${API_BASE}/accounts/${accountId}${path}`, {
      method: init.method,
      headers: {
        // The token appears here and nowhere else. Never logged, never
        // echoed into an error message.
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    throw new StreamProviderError(
      timedOut
        ? "Cloudflare did not answer in time. Nothing was created, so try again."
        : "Could not reach Cloudflare. Check the connection and try again.",
      timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNREACHABLE",
      504
    )
  }

  // A non-JSON body from an API that always speaks JSON means a proxy or an
  // outage answered, not Cloudflare. Don't surface the HTML.
  let body: CloudflareEnvelope<T> | null = null
  try {
    body = (await response.json()) as CloudflareEnvelope<T>
  } catch {
    body = null
  }

  if (!response.ok || body?.success === false) {
    throw new StreamProviderError(describeFailure(response.status, body), "PROVIDER_REFUSED", 502)
  }
  if (!body) {
    throw new StreamProviderError(
      "Cloudflare answered with something that was not JSON.",
      "PROVIDER_BAD_RESPONSE",
      502
    )
  }
  return body
}

export const cloudflareStreamProvider: StreamProvider = {
  id: "cloudflare",
  label: "Cloudflare Stream",
  canProvision: true,

  isConfigured() {
    const { accountId, token } = config()
    // The customer code is NOT required: it comes back inside the create
    // response. See the header note.
    return !!accountId && !!token
  },

  missingConfig() {
    const { accountId, token } = config()
    const missing: string[] = []
    if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID")
    if (!token) missing.push("CLOUDFLARE_STREAM_TOKEN")
    if (missing.length === 0) return null
    return `Set ${missing.join(" and ")} in the server environment, then restart the app. The token needs Cloudflare's Stream:Edit permission.`
  },

  async createChannel(
    name: string,
    options: CreateChannelOptions = {}
  ): Promise<ProvisionedChannel> {
    if (!this.isConfigured()) {
      throw new StreamProviderError(
        this.missingConfig() ?? "Cloudflare is not configured.",
        "PROVIDER_NOT_CONFIGURED",
        400
      )
    }

    const recording = options.recording ?? DEFAULT_RECORDING_MODE

    /**
     * WHY 30 AND NOT 1: 30 is Cloudflare's own floor for this field. Asking
     * for 1 or 7 is refused outright (both tested with a real account on
     * 2026-08-22); the accepted range is 30 to 1096. So 30 is the tightest
     * automatic cleanup the vendor will agree to, and setting it AT CREATION
     * is what makes cleanup structural: every channel provisioned from here
     * has a ceiling on its stored minutes whether or not anyone ever writes
     * the nightly delete job. It caps the worst case; it does not replace the
     * nightly job, which is what keeps storage near zero.
     *
     * The field is top-level on the live input, not inside `recording` — see
     * the response shape at the top of this file.
     */
    const deleteAfterDays = Math.min(
      MAX_DELETE_RECORDING_AFTER_DAYS,
      Math.max(
        MIN_DELETE_RECORDING_AFTER_DAYS,
        Math.round(options.deleteRecordingAfterDays ?? DEFAULT_DELETE_RECORDING_AFTER_DAYS)
      )
    )

    const body = await callCloudflare<CloudflareLiveInput>("/stream/live_inputs", {
      method: "POST",
      body: {
        meta: { name },
        recording: { mode: recording },
        deleteRecordingAfterDays: deleteAfterDays,
      },
    })

    const input = body.result
    const uid = input?.uid?.trim()
    const ingestUrl = input?.rtmps?.url?.trim()
    const streamKey = input?.rtmps?.streamKey?.trim()

    if (!uid || !ingestUrl || !streamKey) {
      throw new StreamProviderError(
        "Cloudflare created the camera but did not return its ingest details. Check the live input in the Cloudflare dashboard before trying again, so you do not end up with two.",
        "PROVIDER_INCOMPLETE",
        502
      )
    }

    // Prefer the code Cloudflare just told us over anything in env: an account
    // has exactly one, and the response is the account we actually called.
    const customerCode =
      customerCodeFromUrl(input?.webRTCPlayback?.url) ??
      customerCodeFromUrl(input?.webRTC?.url) ??
      config().customerCode

    if (!customerCode) {
      throw new StreamProviderError(
        "Cloudflare did not return the account's customer code, so the playback address cannot be built. Set CLOUDFLARE_STREAM_CUSTOMER_CODE (the customer-<code> part of any Cloudflare Stream URL) and try again. The camera was created in Cloudflare, so delete it there first.",
        "PROVIDER_NO_CUSTOMER_CODE",
        502
      )
    }

    return {
      externalId: uid,
      ingestUrl,
      streamKey,
      playbackUrl: buildPlaybackUrl(customerCode, uid),
    }
  },

  async deleteChannel(externalId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new StreamProviderError(
        this.missingConfig() ?? "Cloudflare is not configured.",
        "PROVIDER_NOT_CONFIGURED",
        400
      )
    }
    await callCloudflare(`/stream/live_inputs/${encodeURIComponent(externalId)}`, {
      method: "DELETE",
    })
  },
}
