/**
 * The provider contract, in its own file so a provider and the registry that
 * lists it can both import it without an import cycle (the registry imports
 * every provider; every provider throws the registry's error class).
 *
 * See ./index.ts for what a provider is for and the two standing rules about
 * credentials: env-only, never logged.
 */

/** What a provider hands back once it has made a channel for us. */
export interface ProvisionedChannel {
  /** The vendor's own id for this channel (Cloudflare's live input `uid`). */
  externalId: string
  ingestUrl: string
  streamKey: string
  playbackUrl: string
}

/**
 * Recording is ON by default because on Cloudflare it is not optional in
 * practice: live playback is served out of the recording pipeline, so a live
 * input with recording off connects happily and never produces a manifest.
 * Proven with a real rig on 2026-08-22 (live-streaming-plan.md, "Field notes
 * from the first real camera"), and their low-latency HLS requires it too.
 * "off" is still a choice a person can make, it is simply not the default,
 * because the default has to be the setting that shows a picture.
 */
export const DEFAULT_RECORDING_MODE = "automatic" as const

/**
 * How long the vendor keeps each recording before deleting it by itself.
 *
 * 30 is not a preference, it is Cloudflare's floor: their API refuses 1 and
 * refuses 7 (tested 2026-08-22), and accepts 30 through 1096. Setting it at
 * creation is what makes cleanup structural — a channel provisioned today
 * cannot grow storage forever even if nobody ever writes the nightly delete
 * job. A nightly job is still the right way to keep storage near zero; this
 * only caps the worst case.
 */
export const DEFAULT_DELETE_RECORDING_AFTER_DAYS = 30

/** Cloudflare's accepted range for `deleteRecordingAfterDays`. */
export const MIN_DELETE_RECORDING_AFTER_DAYS = 30
export const MAX_DELETE_RECORDING_AFTER_DAYS = 1096

export interface CreateChannelOptions {
  /**
   * Whether the vendor keeps a recording of everything this channel pushes.
   * Defaults to DEFAULT_RECORDING_MODE ("automatic") — see the note there for
   * why "off" cannot be the default on Cloudflare.
   */
  recording?: "off" | "automatic"
  /**
   * Days the vendor keeps a recording before deleting it on its own. Optional;
   * providers that have no such setting ignore it. Defaults to
   * DEFAULT_DELETE_RECORDING_AFTER_DAYS.
   */
  deleteRecordingAfterDays?: number
}

export interface StreamProvider {
  id: string
  label: string
  /** Can this provider create a channel for us, or does a human paste URLs? */
  canProvision: boolean
  /** True when every env var this provider needs is present. */
  isConfigured(): boolean
  /**
   * What an operator must do to make `isConfigured()` true, in plain words.
   * Names env VARS, never their values. Null when nothing is missing.
   */
  missingConfig(): string | null
  createChannel(name: string, options?: CreateChannelOptions): Promise<ProvisionedChannel>
  deleteChannel?(externalId: string): Promise<void>
}

/**
 * A provider that refused, with a message meant for the person reading the
 * screen. `message` is safe to show: it is either ours or the vendor's own
 * `errors[].message`, never a raw body and never anything holding a secret.
 */
export class StreamProviderError extends Error {
  constructor(
    message: string,
    public code: string = "PROVIDER_ERROR",
    /** What to answer the browser with. 502 = the vendor said no. */
    public status: number = 502
  ) {
    super(message)
    this.name = "StreamProviderError"
  }
}
