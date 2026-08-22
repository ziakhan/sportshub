import { cloudflareStreamProvider } from "./cloudflare"
import { StreamProviderError, type StreamProvider } from "./types"

/**
 * Streaming providers — the thing that turns "I bought a camera" into a
 * channel without anyone opening a vendor dashboard.
 *
 * docs/roadmap/live-streaming-plan.md calls a channel an ingest pair plus a
 * playback URL and is deliberately vendor-agnostic about where they come
 * from. This module is the one place that knows a vendor exists. Everything
 * downstream — placement, the assigner, the game page — still sees nothing
 * but URLs on a StreamChannel row, which is what keeps the A↔B migration in
 * the plan ("trivial by design") true, and is why adding MediaMTX later is a
 * new file here and no change anywhere else.
 *
 * TWO RULES, both of which have bitten this codebase before:
 *
 *  1. CREDENTIALS ARE ENV-ONLY. A provider token never goes in the database
 *     and never gets written to a file in the repo — same rule the S3 upload
 *     keys follow (lib/storage/index.ts), for the same reason: a database
 *     dump must not be able to leak them.
 *  2. NOTHING IS LOGGED. Not the token, not the stream key we get back. The
 *     stream key is a push credential for a youth game's page.
 *
 * The registry always carries `manual` — the operator pasting URLs in by
 * hand, which is how every channel that exists today was made and must keep
 * working whether or not any vendor is configured.
 */

export type { ProvisionedChannel, CreateChannelOptions, StreamProvider } from "./types"
export { StreamProviderError } from "./types"

export const MANUAL_PROVIDER_ID = "manual"

/**
 * The pseudo-provider: no vendor at all, a person pastes what they already
 * have. Always available, never configured-away, cannot provision.
 */
export const manualProvider: StreamProvider = {
  id: MANUAL_PROVIDER_ID,
  label: "Custom",
  canProvision: false,
  isConfigured: () => true,
  missingConfig: () => null,
  createChannel() {
    return Promise.reject(
      new StreamProviderError(
        "Custom cameras are set up by pasting their addresses, not created for you.",
        "NOT_PROVISIONABLE",
        400
      )
    )
  },
}

/** Every provider the platform knows about, configured or not. */
export function listProviders(): StreamProvider[] {
  return [cloudflareStreamProvider, manualProvider]
}

export function getProvider(id: string): StreamProvider | null {
  const wanted = id.trim().toLowerCase()
  return listProviders().find((provider) => provider.id === wanted) ?? null
}

/** One provider as the Add-a-camera form sees it. */
export interface ProviderInfo {
  id: string
  label: string
  canProvision: boolean
  configured: boolean
  /** Why it cannot be used yet. Null when it can. */
  missing: string | null
}

/**
 * The form's menu. An unconfigured provider is still listed — a disabled
 * option that says which env vars are missing is a lead the operator can
 * follow; a provider that silently vanishes is a mystery.
 */
export function describeProviders(): ProviderInfo[] {
  return listProviders().map((provider) => {
    const configured = provider.isConfigured()
    return {
      id: provider.id,
      label: provider.label,
      canProvision: provider.canProvision,
      configured,
      missing: configured ? null : provider.missingConfig(),
    }
  })
}

export { cloudflareStreamProvider }
