/** Serialized (Decimal→number) shapes shared by the payments UI. */

export interface PaymentRow {
  id: string
  amount: number
  status: string
  method: string
  note: string | null
  refundAmount: number | null
  createdAt: string
  recordedBy?: { firstName: string | null; lastName: string | null } | null
}

export interface ObligationRow {
  id: string
  description: string
  amount: number
  currency: string
  status: string
  createdAt: string
  referenceType: string
  /** Who owes (merchant view) */
  payerName?: string | null
  /** Who is owed (payer view) */
  payeeName?: string | null
  payments: PaymentRow[]
  /** Payer view: can this be paid online right now? */
  payOnline?: boolean
  /** Payer view: offline instructions ("Pay at the door / e-transfer") */
  offlineMethods?: string[]
}

export const OBLIGATION_STATUS_STYLE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Owed", className: "bg-hoop-50 text-hoop-700" },
  PARTIALLY_PAID: { label: "Partially paid", className: "bg-play-50 text-play-700" },
  PAID: { label: "Paid", className: "bg-court-50 text-court-700" },
  WAIVED: { label: "Waived", className: "bg-ink-100 text-ink-600" },
  CANCELLED: { label: "Cancelled", className: "bg-ink-100 text-ink-500" },
  REFUNDED: { label: "Refunded", className: "bg-ink-100 text-ink-600" },
}

export const METHOD_LABEL: Record<string, string> = {
  STRIPE: "Card (online)",
  CASH: "Cash",
  ETRANSFER: "e-Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
}

export const TYPE_LABEL: Record<string, string> = {
  TryoutSignup: "Tryout fee",
  Offer: "Season fee",
  CampSignup: "Camp",
  HouseLeagueSignup: "House league",
  TeamSubmission: "Team fee",
}

export function paidSoFar(o: ObligationRow): number {
  return o.payments
    .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
    .reduce((sum, p) => sum + p.amount - (p.refundAmount ?? 0), 0)
}
