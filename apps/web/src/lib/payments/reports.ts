import type { ObligationRow } from "@/components/payments/types"

/** Friendly labels for the payment-obligation reference types that carry fees. */
export const PROGRAM_LABELS: Record<string, string> = {
  CampSignup: "Camps",
  HouseLeagueSignup: "House Leagues",
  TryoutSignup: "Tryouts",
  Offer: "Team Offers / Season Fees",
  TeamSubmission: "League Team Fees",
  Season: "Season Fees",
}

export function programLabel(referenceType: string): string {
  return (
    PROGRAM_LABELS[referenceType] ??
    referenceType.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/Signup$/, "")
  )
}

export interface TxnRow {
  date: string // ISO
  payer: string
  program: string
  description: string
  gross: number
  refund: number
  net: number
  method: string
  status: string
}

export interface ProgramRevenue {
  referenceType: string
  label: string
  collected: number
  outstanding: number
  count: number
}

export interface AccountingReport {
  currency: string
  totals: { collected: number; outstanding: number; waived: number; net: number }
  byProgram: ProgramRevenue[]
  transactions: TxnRow[]
}

/**
 * Build a treasurer-facing accounting report from a merchant's obligations
 * (works for a club OR a league — same shape). Pure/serializable.
 */
export function buildAccountingReport(obligations: ObligationRow[]): AccountingReport {
  let collected = 0
  let outstanding = 0
  let waived = 0
  const currency = obligations[0]?.currency ?? "CAD"

  const prog = new Map<string, ProgramRevenue>()
  const transactions: TxnRow[] = []

  for (const o of obligations) {
    const paid = o.payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
      .reduce((s, p) => s + p.amount - (p.refundAmount ?? 0), 0)
    collected += paid
    if (["PENDING", "PARTIALLY_PAID"].includes(o.status)) {
      outstanding += Math.max(0, o.amount - paid)
    }
    if (o.status === "WAIVED") waived += Math.max(0, o.amount - paid)

    const label = programLabel(o.referenceType)
    const row = prog.get(o.referenceType) ?? {
      referenceType: o.referenceType,
      label,
      collected: 0,
      outstanding: 0,
      count: 0,
    }
    row.collected += paid
    if (["PENDING", "PARTIALLY_PAID"].includes(o.status)) {
      row.outstanding += Math.max(0, o.amount - paid)
    }
    row.count += 1
    prog.set(o.referenceType, row)

    for (const p of o.payments) {
      if (p.status !== "SUCCEEDED" && p.status !== "REFUNDED") continue
      const refund = p.refundAmount ?? 0
      transactions.push({
        date: p.createdAt,
        payer: (o as any).payerName ?? "—",
        program: label,
        description: o.description,
        gross: p.amount,
        refund,
        net: p.amount - refund,
        method: p.method,
        status: p.status,
      })
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first

  return {
    currency,
    totals: { collected, outstanding, waived, net: collected },
    byProgram: Array.from(prog.values()).sort((a, b) => b.collected - a.collected),
    transactions,
  }
}

/** QuickBooks-friendly CSV of the transactions (client downloads this). */
export function transactionsToCsv(report: AccountingReport): string {
  const header = ["Date", "Payer", "Program", "Description", "Gross", "Refund", "Net", "Method", "Status"]
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [header.join(",")]
  for (const t of report.transactions) {
    lines.push(
      [
        t.date.slice(0, 10),
        esc(t.payer),
        esc(t.program),
        esc(t.description),
        t.gross.toFixed(2),
        t.refund.toFixed(2),
        t.net.toFixed(2),
        t.method,
        t.status,
      ].join(",")
    )
  }
  return lines.join("\n")
}
