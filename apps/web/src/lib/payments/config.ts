import { prisma } from "@youthbasketballhub/db"

/**
 * Payment-config resolution (docs/payments-design.md). Every merchant — a
 * club today, a league in phase 2 — has at most one PaymentConfig row; until
 * one is written, these defaults apply (offline bookkeeping on, no online
 * mode, no platform fee).
 */

export const DEFAULT_PAYMENT_CONFIG = {
  offlineAllowed: true,
  connectAllowed: true,
  platformCollectAllowed: false,
  offlineEnabled: true,
  offlineMethods: ["CASH", "ETRANSFER"] as string[],
  onlineMode: "NONE" as "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT",
  platformFeeBps: 0,
  platformFeeFlat: 0,
  stripeAccountId: null as string | null,
  stripeAccountStatus: null as string | null,
}

export type ResolvedPaymentConfig = typeof DEFAULT_PAYMENT_CONFIG & { id: string | null }

type MerchantRef = { tenantId: string } | { leagueId: string }

export async function getPaymentConfig(merchant: MerchantRef): Promise<ResolvedPaymentConfig> {
  const row = await prisma.paymentConfig.findUnique({ where: merchant as any })
  if (!row) return { ...DEFAULT_PAYMENT_CONFIG, id: null }
  return {
    id: row.id,
    offlineAllowed: row.offlineAllowed,
    connectAllowed: row.connectAllowed,
    platformCollectAllowed: row.platformCollectAllowed,
    offlineEnabled: row.offlineEnabled,
    offlineMethods: row.offlineMethods as string[],
    onlineMode: row.onlineMode as ResolvedPaymentConfig["onlineMode"],
    platformFeeBps: row.platformFeeBps,
    platformFeeFlat: Number(row.platformFeeFlat),
    stripeAccountId: row.stripeAccountId,
    stripeAccountStatus: row.stripeAccountStatus,
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
