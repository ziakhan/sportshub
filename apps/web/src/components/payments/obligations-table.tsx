"use client"

import Link from "next/link"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import {
  METHOD_LABEL,
  OBLIGATION_STATUS_STYLE,
  TYPE_LABEL,
  paidSoFar,
  daysOverdue,
  type ObligationRow,
} from "./types"
import { PayOnlineButton } from "./pay-online"

/**
 * The one payments table, both directions:
 *  - merchant view (club/league): who owes us; record cash, waive, refund
 *  - payer view (parent, or club paying a league): what we owe; pay online
 */
export function ObligationsTable({
  obligations,
  view,
  canRecord = false,
  canWaive = false,
  canRefund = false,
}: {
  obligations: ObligationRow[]
  view: "merchant" | "payer"
  canRecord?: boolean
  canWaive?: boolean
  canRefund?: boolean
}) {
  const router = useRouter()
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [recordFor, setRecordFor] = useState<ObligationRow | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("ALL")

  const filtered =
    filter === "ALL"
      ? obligations
      : filter === "OPEN"
        ? obligations.filter((o) => ["PENDING", "PARTIALLY_PAID"].includes(o.status))
        : obligations.filter((o) => o.status === filter)

  async function act(label: string, fn: () => Promise<Response>) {
    setBusy(label)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || "Something went wrong")
      } else {
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  const waive = (o: ObligationRow) => {
    if (!confirm(`Waive the remaining balance on "${o.description}"?`)) return
    act(`waive-${o.id}`, () =>
      fetch(`/api/obligations/${o.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "waive" }),
      })
    )
  }

  const refund = (o: ObligationRow, paymentId: string, amount: number) => {
    if (!confirm(`Refund ${formatCurrency(amount, o.currency)}?`)) return
    act(`refund-${paymentId}`, () =>
      fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "refund" }),
      })
    )
  }

  if (obligations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
        No payments here yet.
      </p>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md bg-hoop-50 px-3 py-2 text-sm text-hoop-700">{error}</div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {["ALL", "OPEN", "PAID", "WAIVED", "CANCELLED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
            }`}
          >
            {f === "ALL" ? "All" : f === "OPEN" ? "Open" : OBLIGATION_STATUS_STYLE[f]?.label ?? f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">{view === "merchant" ? "From" : "To"}</th>
              <th className="px-4 py-3">For</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const paid = paidSoFar(o)
              const remaining = Math.max(0, o.amount - paid)
              const open = ["PENDING", "PARTIALLY_PAID"].includes(o.status)
              const style = OBLIGATION_STATUS_STYLE[o.status] ?? {
                label: o.status,
                className: "bg-ink-100 text-ink-600",
              }
              return (
                <FragmentRow key={o.id}>
                  <tr
                    className="cursor-pointer border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                    onClick={() => setOpenRow(openRow === o.id ? null : o.id)}
                  >
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {view === "payer" && o.payeeHref ? (
                        <Link
                          href={o.payeeHref}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-play-600 transition-colors"
                        >
                          {o.payeeName || "—"}
                        </Link>
                      ) : (
                        (view === "merchant" ? o.payerName : o.payeeName) || "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      <span className="mr-2 rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">
                        {TYPE_LABEL[o.referenceType] ?? o.referenceType}
                      </span>
                      {o.description}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(o.amount, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-600">
                      {paid > 0 ? formatCurrency(paid, o.currency) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
                        {style.label}
                      </span>
                      {daysOverdue(o) > 0 && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Overdue {daysOverdue(o)}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {view === "payer" && open && o.payOnline && (
                          <PayOnlineButton
                            obligationId={o.id}
                            amount={remaining}
                            currency={o.currency}
                          />
                        )}
                        {view === "merchant" && open && canRecord && (
                          <button
                            onClick={() => setRecordFor(o)}
                            className="rounded-md bg-court-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-court-700"
                          >
                            Record payment
                          </button>
                        )}
                        {view === "merchant" && open && canWaive && (
                          <button
                            onClick={() => waive(o)}
                            disabled={busy === `waive-${o.id}`}
                            className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50"
                          >
                            Waive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {openRow === o.id && (
                    <tr className="border-b border-ink-50 bg-ink-50/40 last:border-0">
                      <td colSpan={6} className="px-6 py-3">
                        {o.payments.length === 0 ? (
                          <p className="text-xs text-ink-500">
                            No payments recorded yet.
                            {view === "payer" && o.offlineMethods?.length ? (
                              <>
                                {" "}
                                This organization also accepts:{" "}
                                {o.offlineMethods.map((m) => METHOD_LABEL[m] ?? m).join(", ")} —
                                pay them directly and they&apos;ll record it here. Offline payments
                                are arranged directly with the organizer — the platform can&apos;t
                                refund them.
                              </>
                            ) : null}
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {o.payments.map((p) => (
                              <li key={p.id} className="flex items-center justify-between text-xs">
                                <span className="text-ink-600">
                                  {format(new Date(p.createdAt), "MMM d, yyyy")} ·{" "}
                                  {METHOD_LABEL[p.method] ?? p.method}
                                  {p.recordedBy
                                    ? ` · recorded by ${p.recordedBy.firstName ?? ""} ${p.recordedBy.lastName ?? ""}`.trimEnd()
                                    : ""}
                                  {p.note ? ` · “${p.note}”` : ""}
                                </span>
                                <span className="flex items-center gap-3">
                                  <span
                                    className={
                                      p.status === "SUCCEEDED"
                                        ? "font-medium text-court-700"
                                        : p.status === "REFUNDED"
                                          ? "text-ink-500 line-through"
                                          : "text-ink-500"
                                    }
                                  >
                                    {formatCurrency(p.amount, o.currency)}
                                    {p.refundAmount
                                      ? ` (refunded ${formatCurrency(p.refundAmount, o.currency)})`
                                      : ""}
                                    {p.status === "PENDING" ? " · processing" : ""}
                                    {p.status === "FAILED" ? " · failed" : ""}
                                  </span>
                                  {view === "merchant" &&
                                    canRefund &&
                                    p.status === "SUCCEEDED" &&
                                    !p.refundAmount && (
                                      <button
                                        onClick={() => refund(o, p.id, p.amount)}
                                        disabled={busy === `refund-${p.id}`}
                                        className="rounded border border-ink-200 px-2 py-0.5 text-ink-600 hover:bg-white"
                                      >
                                        Refund
                                      </button>
                                    )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              )
            })}
          </tbody>
        </table>
      </div>

      {recordFor && (
        <RecordPaymentModal
          obligation={recordFor}
          onClose={() => setRecordFor(null)}
          onDone={() => {
            setRecordFor(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function RecordPaymentModal({
  obligation,
  onClose,
  onDone,
}: {
  obligation: ObligationRow
  onClose: () => void
  onDone: () => void
}) {
  const remaining = Math.max(0, obligation.amount - paidSoFar(obligation))
  const [amount, setAmount] = useState(String(remaining.toFixed(2)))
  const [method, setMethod] = useState("CASH")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/obligations/${obligation.id}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), method, note: note || undefined }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || "Failed to record payment")
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-ink-900">Record a payment</h3>
        <p className="mt-1 text-sm text-ink-500">
          {obligation.description} — {formatCurrency(remaining, obligation.currency)} remaining
        </p>
        {error && (
          <div className="mt-3 rounded-md bg-hoop-50 px-3 py-2 text-sm text-hoop-700">{error}</div>
        )}
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Amount received</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-ink-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Method</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-md border border-ink-200 px-3 py-2"
            >
              <option value="CASH">Cash</option>
              <option value="ETRANSFER">e-Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. paid at the door"
              className="w-full rounded-md border border-ink-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || Number(amount) <= 0}
            className="rounded-md bg-court-600 px-4 py-2 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  )
}
