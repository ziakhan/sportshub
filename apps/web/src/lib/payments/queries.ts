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
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    recordedBy: p.recordedBy,
  }
}

/** Obligation's own dueDate, else the earliest unpaid installment's. */
function effectiveDueDate(o: any): string | null {
  if (o.dueDate) return o.dueDate.toISOString()
  const unpaid = o.payments
    .filter((p: any) => p.dueDate && !["SUCCEEDED", "REFUNDED"].includes(p.status))
    .map((p: any) => p.dueDate.getTime())
  return unpaid.length ? new Date(Math.min(...unpaid)).toISOString() : null
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
    dueDate: effectiveDueDate(o),
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
      dueDate: effectiveDueDate(o),
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

/** Tiles: collected / outstanding / overdue (aging) / waived + by-type. */
export function summarize(obligations: ObligationRow[], now = Date.now()) {
  let collected = 0
  let outstanding = 0
  let waived = 0
  let overdue = 0
  let overdueCount = 0
  // Aging buckets over the overdue slice (owner ask 2026-07-21: any kind of
  // overdue must be visible)
  const aging = { d1to30: 0, d31to60: 0, d60plus: 0 }
  const byType = new Map<string, number>()
  for (const o of obligations) {
    const paid = o.payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
      .reduce((s, p) => s + p.amount - (p.refundAmount ?? 0), 0)
    collected += paid
    byType.set(o.referenceType, (byType.get(o.referenceType) ?? 0) + paid)
    if (["PENDING", "PARTIALLY_PAID"].includes(o.status)) {
      const owed = Math.max(0, o.amount - paid)
      outstanding += owed
      if (owed > 0 && o.dueDate) {
        const daysLate = Math.floor((now - new Date(o.dueDate).getTime()) / 86_400_000)
        if (daysLate > 0) {
          overdue += owed
          overdueCount += 1
          if (daysLate <= 30) aging.d1to30 += owed
          else if (daysLate <= 60) aging.d31to60 += owed
          else aging.d60plus += owed
        }
      }
    }
    if (o.status === "WAIVED") waived += Math.max(0, o.amount - paid)
  }
  return {
    collected,
    outstanding,
    waived,
    overdue,
    overdueCount,
    aging,
    byType: Array.from(byType.entries()),
  }
}
