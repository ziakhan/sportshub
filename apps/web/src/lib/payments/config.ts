import { prisma } from "@youthbasketballhub/db"

/**
 * Payment-config resolution (docs/payments-design.md).
 *
 * Two layers:
 *  1. PlatformSettings.pay* — the system-wide policy the platform admin sets
 *     (which modes exist at all, the default mode, the default fee).
 *  2. PaymentConfig — at most one row per merchant (club today, league in
 *     phase 2). Every policy field is nullable: null = inherit the platform
 *     default, non-null = a per-merchant override.
 *
 * Callers only ever see the RESOLVED config; `onlineMode` is the effective
 * mode after clamping the merchant's choice to the allowlist, so a revoked
 * mode can never keep charging.
 */

export const FALLBACK_PLATFORM_POLICY = {
  payOfflineAllowed: true,
  payConnectAllowed: true,
  payPlatformCollectAllowed: false,
  payDefaultOnlineMode: "NONE" as OnlineModeValue,
  payPlatformFeeBps: 0,
  payPlatformFeeFlat: 0,
}

export type OnlineModeValue = "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT"

export type PlatformPaymentPolicy = typeof FALLBACK_PLATFORM_POLICY

export interface ResolvedPaymentConfig {
  id: string | null
  offlineAllowed: boolean
  connectAllowed: boolean
  platformCollectAllowed: boolean
  offlineEnabled: boolean
  offlineMethods: string[]
  /** Effective mode: merchant choice (or platform default) clamped to the allowlist. */
  onlineMode: OnlineModeValue
  /** The merchant's raw choice (null = inheriting the platform default). */
  chosenOnlineMode: OnlineModeValue | null
  platformFeeBps: number
  platformFeeFlat: number
  stripeAccountId: string | null
  stripeAccountStatus: string | null
}

type MerchantRef = { tenantId: string } | { leagueId: string }

export async function getPlatformPaymentPolicy(): Promise<PlatformPaymentPolicy> {
  const settings = await prisma.platformSettings.findUnique({ where: { id: "default" } })
  if (!settings) return { ...FALLBACK_PLATFORM_POLICY }
  return {
    payOfflineAllowed: settings.payOfflineAllowed,
    payConnectAllowed: settings.payConnectAllowed,
    payPlatformCollectAllowed: settings.payPlatformCollectAllowed,
    payDefaultOnlineMode: settings.payDefaultOnlineMode as OnlineModeValue,
    payPlatformFeeBps: settings.payPlatformFeeBps,
    payPlatformFeeFlat: Number(settings.payPlatformFeeFlat),
  }
}

/** Clamp a mode to the allowlist; a banned mode falls back to the other allowed one. */
function effectiveOnlineMode(
  mode: OnlineModeValue,
  allow: { connect: boolean; platformCollect: boolean }
): OnlineModeValue {
  if (mode === "CONNECT_DIRECT" && !allow.connect) {
    return allow.platformCollect ? "PLATFORM_COLLECT" : "NONE"
  }
  if (mode === "PLATFORM_COLLECT" && !allow.platformCollect) {
    return allow.connect ? "CONNECT_DIRECT" : "NONE"
  }
  return mode
}

export async function getPaymentConfig(merchant: MerchantRef): Promise<ResolvedPaymentConfig> {
  const [policy, row] = await Promise.all([
    getPlatformPaymentPolicy(),
    prisma.paymentConfig.findUnique({ where: merchant as any }),
  ])

  const offlineAllowed = row?.offlineAllowed ?? policy.payOfflineAllowed
  const connectAllowed = row?.connectAllowed ?? policy.payConnectAllowed
  const platformCollectAllowed = row?.platformCollectAllowed ?? policy.payPlatformCollectAllowed
  const chosen = (row?.onlineMode as OnlineModeValue | null) ?? null

  return {
    id: row?.id ?? null,
    offlineAllowed,
    connectAllowed,
    platformCollectAllowed,
    offlineEnabled: row?.offlineEnabled ?? true,
    offlineMethods: (row?.offlineMethods as string[] | undefined) ?? ["CASH", "ETRANSFER"],
    onlineMode: effectiveOnlineMode(chosen ?? policy.payDefaultOnlineMode, {
      connect: connectAllowed,
      platformCollect: platformCollectAllowed,
    }),
    chosenOnlineMode: chosen,
    platformFeeBps: row?.platformFeeBps ?? policy.payPlatformFeeBps,
    platformFeeFlat:
      row?.platformFeeFlat != null ? Number(row.platformFeeFlat) : policy.payPlatformFeeFlat,
    stripeAccountId: row?.stripeAccountId ?? null,
    stripeAccountStatus: row?.stripeAccountStatus ?? null,
  }
}

/** Can this merchant take offline (pay-at-the-door / e-transfer) payments? */
export function offlineAvailable(config: ResolvedPaymentConfig): boolean {
  return config.offlineAllowed && config.offlineEnabled
}

/** Platform fee for an online charge, in the charge currency. */
export function platformFeeFor(config: ResolvedPaymentConfig, amount: number): number {
  return Math.round((amount * config.platformFeeBps) / 100) / 100 + config.platformFeeFlat
}

/**
 * Online payments need a ready Stripe account in BOTH modes — direct charges
 * live on it, destination charges transfer the club's share into it.
 */
export function onlineReady(config: ResolvedPaymentConfig): boolean {
  return (
    config.onlineMode !== "NONE" &&
    !!config.stripeAccountId &&
    config.stripeAccountStatus === "active"
  )
}
