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

export interface CreateChannelOptions {
  /**
   * Whether the vendor keeps a recording of everything this channel pushes.
   *
   * Defaults to "off" everywhere, deliberately: recordings are billed for
   * storage for as long as they exist, and the owner has not decided whether
   * we want them (live-streaming-plan.md, open decision #4). Turning this on
   * is a spending decision, so it is never the default.
   */
  recording?: "off" | "automatic"
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
