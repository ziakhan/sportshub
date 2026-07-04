/**
 * Collection postures — the 7 coherent combinations of the payment-policy
 * flags (docs/payments-design.md). The raw model is 3 allow-flags + a default
 * online mode (24 combos, 12 coherent); the UI only ever offers these
 * postures, so incoherent states (nothing allowed, dead-end defaults) are
 * unrepresentable. Client-safe: no prisma import.
 */

export type OnlineModeValue = "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT"

export interface PostureFlags {
  offlineAllowed: boolean
  connectAllowed: boolean
  platformCollectAllowed: boolean
}

export interface Posture extends PostureFlags {
  key: string
  label: string
  hint: string
  /** What a club that hasn't chosen a mode starts on. */
  defaultOnlineMode: OnlineModeValue
}

export const POSTURES: Posture[] = [
  {
    key: "OFFLINE_ONLY",
    label: "Offline only",
    hint: "Cash / e-transfer recorded by the club; no card payments.",
    offlineAllowed: true,
    connectAllowed: false,
    platformCollectAllowed: false,
    defaultOnlineMode: "NONE",
  },
  {
    key: "OFFLINE_CONNECT",
    label: "Offline + own Stripe",
    hint: "Clubs may also connect their own Stripe account for card payments.",
    offlineAllowed: true,
    connectAllowed: true,
    platformCollectAllowed: false,
    defaultOnlineMode: "NONE",
  },
  {
    key: "OFFLINE_PLATFORM",
    label: "Offline + through us",
    hint: "Card payments run through the platform; club's share transfers instantly.",
    offlineAllowed: true,
    connectAllowed: false,
    platformCollectAllowed: true,
    defaultOnlineMode: "NONE",
  },
  {
    key: "OFFLINE_CHOICE",
    label: "Offline + club's choice of rail",
    hint: "Clubs pick their own Stripe account or the platform for card payments.",
    offlineAllowed: true,
    connectAllowed: true,
    platformCollectAllowed: true,
    defaultOnlineMode: "NONE",
  },
  {
    key: "ONLINE_CONNECT",
    label: "Online required — own Stripe",
    hint: "No cash/pay-later. Every payment is a card charge on the club's Stripe account.",
    offlineAllowed: false,
    connectAllowed: true,
    platformCollectAllowed: false,
    defaultOnlineMode: "CONNECT_DIRECT",
  },
  {
    key: "ONLINE_PLATFORM",
    label: "Online required — through us",
    hint: "No cash/pay-later. Every payment runs through the platform.",
    offlineAllowed: false,
    connectAllowed: false,
    platformCollectAllowed: true,
    defaultOnlineMode: "PLATFORM_COLLECT",
  },
  {
    key: "ONLINE_CHOICE",
    label: "Online required — club's choice of rail",
    hint: "No cash/pay-later. Clubs pick their own Stripe account or the platform.",
    offlineAllowed: false,
    connectAllowed: true,
    platformCollectAllowed: true,
    defaultOnlineMode: "NONE", // no single rail to default to — the club must pick
  },
]

export function postureByKey(key: string): Posture | undefined {
  return POSTURES.find((p) => p.key === key)
}

/** Match flags back to a posture (default mode is derived, not matched). */
export function postureFromFlags(flags: PostureFlags): Posture | undefined {
  return POSTURES.find(
    (p) =>
      p.offlineAllowed === flags.offlineAllowed &&
      p.connectAllowed === flags.connectAllowed &&
      p.platformCollectAllowed === flags.platformCollectAllowed
  )
}
