import type { ObligationRow } from "@/components/payments/types"

/** Friendly labels for the payment-obligation reference types that carry fees. */
export const PROGRAM_LABELS: Record<string, string> = {
  CampSignup: "Camps",
  HouseLeagueSignup: "House Leagues",
  TryoutSignup: "Tryouts",
  Offer: "Team Offers / Season Fees",
  TeamSubmission: "League Team Fees",
  Season: "Season Fees",
  TrainingSessionSignup: "Training Sessions",
  OneOnOneBooking: "1-on-1 Training",
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
const esc = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function transactionsToCsv(report: AccountingReport): string {
  const header = ["Date", "Payer", "Program", "Description", "Gross", "Refund", "Net", "Method", "Status"]
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

/**
 * QuickBooks (Online & Desktop) bank-transactions import — the 3-column
 * format QBO's "Upload from file" accepts without a mapping step
 * (Date, Description, Amount). Money-in rows, net of refunds.
 */
export function transactionsToQuickBooksCsv(report: AccountingReport): string {
  const lines = ["Date,Description,Amount"]
  for (const t of report.transactions) {
    const description = `${t.payer} — ${t.program}${t.description ? ` — ${t.description}` : ""}`
    lines.push([t.date.slice(0, 10), esc(description), t.net.toFixed(2)].join(","))
  }
  return lines.join("\n")
}

/**
 * Xero bank-statement import (their published CSV template:
 * *Date, *Amount, Payee, Description, Reference). Net of refunds.
 */
export function transactionsToXeroCsv(report: AccountingReport): string {
  const lines = ["*Date,*Amount,Payee,Description,Reference"]
  for (const t of report.transactions) {
    lines.push(
      [
        t.date.slice(0, 10),
        t.net.toFixed(2),
        esc(t.payer),
        esc(`${t.program}${t.description ? ` — ${t.description}` : ""}`),
        esc(t.method),
      ].join(",")
    )
  }
  return lines.join("\n")
}

export type ExportFormat = "generic" | "quickbooks" | "xero"

export const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string; hint: string }> = [
  { value: "generic", label: "CSV (full detail)", hint: "Every column — Excel, Google Sheets, Wave" },
  { value: "quickbooks", label: "QuickBooks CSV", hint: "3-column bank import (Date, Description, Amount)" },
  { value: "xero", label: "Xero CSV", hint: "Bank statement template (*Date, *Amount, Payee…)" },
]

export function exportTransactions(report: AccountingReport, format: ExportFormat): string {
  if (format === "quickbooks") return transactionsToQuickBooksCsv(report)
  if (format === "xero") return transactionsToXeroCsv(report)
  return transactionsToCsv(report)
}
