import { prisma } from "@youthbasketballhub/db"
import { getPaymentConfig, offlineAvailable, onlineReady, type ResolvedPaymentConfig } from "./config"
import type { ObligationRow } from "@/components/payments/types"

/**
 * Server-side fetch + serialize for the payments UI (Decimal→number at the
 * boundary — the Vercel serialization rule).
 */

const paymentsInclude = {
  orderBy: { createdAt: "asc" as const },
  include: { recordedBy: { select: { firstName: true, lastName: true } } },
}

function serializePayment(p: any) {
  return {
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    method: p.method,
    note: p.note,
    refundAmount: p.refundAmount === null ? null : Number(p.refundAmount),
    createdAt: p.createdAt.toISOString(),
    recordedBy: p.recordedBy,
  }
}

/** Everything owed TO a merchant (club or league). */
export async function merchantObligations(
  merchant: { tenantId: string } | { leagueId: string }
): Promise<ObligationRow[]> {
  const where =
    "tenantId" in merchant
      ? { payeeTenantId: merchant.tenantId }
      : { payeeLeagueId: merchant.leagueId }
  const rows = await prisma.paymentObligation.findMany({
    where,
    include: {
      payerUser: { select: { firstName: true, lastName: true, email: true } },
      payerTenant: { select: { name: true } },
      payments: paymentsInclude,
    },
    orderBy: { createdAt: "desc" },
    take: 500, // obligations accumulate per player per season (gap-audit P1 #18)
  })
  return rows.map((o: any) => ({
    id: o.id,
    description: o.description,
    amount: Number(o.amount),
    currency: o.currency,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    referenceType: o.referenceType,
    payerName:
      o.payerTenant?.name ??
      (o.payerUser
        ? `${o.payerUser.firstName ?? ""} ${o.payerUser.lastName ?? ""}`.trim() || o.payerUser.email
        : null),
    payments: o.payments.map(serializePayment),
  }))
}

/** Everything a payer owes — a person, or a club paying leagues. */
export async function payerObligations(
  payer: { userId: string } | { tenantId: string }
): Promise<ObligationRow[]> {
  const where =
    "userId" in payer ? { payerUserId: payer.userId } : { payerTenantId: payer.tenantId }
  const rows = await prisma.paymentObligation.findMany({
    where,
    include: {
      payeeTenant: { select: { id: true, name: true, slug: true } },
      payeeLeague: { select: { id: true, name: true } },
      payments: paymentsInclude,
    },
    orderBy: { createdAt: "desc" },
    take: 500, // obligations accumulate per player per season (gap-audit P1 #18)
  })

  // Payment availability per payee (one config lookup per distinct payee)
  const configCache = new Map<string, ResolvedPaymentConfig>()
  async function configFor(o: any): Promise<ResolvedPaymentConfig | null> {
    const key = o.payeeTenantId ? `t:${o.payeeTenantId}` : o.payeeLeagueId ? `l:${o.payeeLeagueId}` : ""
    if (!key) return null
    if (!configCache.has(key)) {
      configCache.set(
        key,
        await getPaymentConfig(
          o.payeeTenantId ? { tenantId: o.payeeTenantId } : { leagueId: o.payeeLeagueId }
        )
      )
    }
    return configCache.get(key)!
  }

  const out: ObligationRow[] = []
  for (const o of rows as any[]) {
    const config = await configFor(o)
    const payOnline = !!config && onlineReady(config)
    out.push({
      id: o.id,
      description: o.description,
      amount: Number(o.amount),
      currency: o.currency,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      referenceType: o.referenceType,
      payeeName: o.payeeTenant?.name ?? o.payeeLeague?.name ?? null,
      payeeHref: o.payeeTenant?.slug
        ? `/club/${o.payeeTenant.slug}`
        : o.payeeLeague?.id
          ? `/league/hub/${o.payeeLeague.id}`
          : null,
      payments: o.payments.map(serializePayment),
      payOnline,
      offlineMethods: config && offlineAvailable(config) ? config.offlineMethods : [],
    })
  }
  return out
}

/** Tiles: collected / outstanding / waived-refunded + by-type breakdown. */
export function summarize(obligations: ObligationRow[]) {
  let collected = 0
  let outstanding = 0
  let waived = 0
  const byType = new Map<string, number>()
  for (const o of obligations) {
    const paid = o.payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
      .reduce((s, p) => s + p.amount - (p.refundAmount ?? 0), 0)
    collected += paid
    byType.set(o.referenceType, (byType.get(o.referenceType) ?? 0) + paid)
    if (["PENDING", "PARTIALLY_PAID"].includes(o.status)) {
      outstanding += Math.max(0, o.amount - paid)
    }
    if (o.status === "WAIVED") waived += Math.max(0, o.amount - paid)
  }
  return { collected, outstanding, waived, byType: Array.from(byType.entries()) }
}
