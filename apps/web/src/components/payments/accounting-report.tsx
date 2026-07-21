"use client"

import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/countries"
import { transactionsToCsv, type AccountingReport } from "@/lib/payments/reports"

/**
 * Treasurer-facing accounting view (owner 2026-07-20/21 — sales asset): summary
 * tiles, revenue per program, a transactions table, and a QuickBooks-friendly
 * CSV export. Shared by the club and league accounting pages (same shape).
 */
export function AccountingReportView({
  report,
  currency,
  exportName,
}: {
  report: AccountingReport
  currency: string
  exportName: string
}) {
  const [programFilter, setProgramFilter] = useState<string>("")

  const txns = useMemo(
    () =>
      programFilter
        ? report.transactions.filter((t) => t.program === programFilter)
        : report.transactions,
    [report.transactions, programFilter]
  )

  function downloadCsv() {
    const csv = transactionsToCsv(
      programFilter ? { ...report, transactions: txns } : report
    )
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${exportName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const money = (n: number) => formatCurrency(n, currency)

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Collected" value={money(report.totals.collected)} tone="text-court-700" />
        <Tile label="Outstanding" value={money(report.totals.outstanding)} tone="text-hoop-700" />
        <Tile label="Waived" value={money(report.totals.waived)} tone="text-ink-500" />
      </div>

      {/* Revenue by program */}
      <section className="border-ink-200 overflow-hidden rounded-2xl border bg-white">
        <div className="border-ink-100 flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-ink-900 font-semibold">Revenue by program</h3>
        </div>
        {report.byProgram.length === 0 ? (
          <p className="text-ink-500 p-4 text-sm">No revenue yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-400 text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-2 font-semibold">Program</th>
                <th className="px-4 py-2 text-right font-semibold">Collected</th>
                <th className="px-4 py-2 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-2 text-right font-semibold">Registrations</th>
              </tr>
            </thead>
            <tbody>
              {report.byProgram.map((p) => (
                <tr key={p.referenceType} className="border-ink-50 border-t">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setProgramFilter(programFilter === p.label ? "" : p.label)}
                      className={`font-medium hover:underline ${programFilter === p.label ? "text-play-700" : "text-ink-800"}`}
                      title="Filter the transactions below"
                    >
                      {p.label}
                    </button>
                  </td>
                  <td className="text-court-700 px-4 py-2.5 text-right font-semibold">
                    {money(p.collected)}
                  </td>
                  <td className="text-ink-600 px-4 py-2.5 text-right">{money(p.outstanding)}</td>
                  <td className="text-ink-600 px-4 py-2.5 text-right">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Transactions */}
      <section className="border-ink-200 overflow-hidden rounded-2xl border bg-white">
        <div className="border-ink-100 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-ink-900 font-semibold">
            Transactions{" "}
            <span className="text-ink-400 text-sm font-normal">({txns.length})</span>
            {programFilter ? (
              <button
                type="button"
                onClick={() => setProgramFilter("")}
                className="text-play-700 ml-2 text-xs font-medium hover:underline"
              >
                {programFilter} · clear
              </button>
            ) : null}
          </h3>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={txns.length === 0}
            className="border-ink-200 hover:border-ink-300 inline-flex items-center gap-1.5 rounded-xl border bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 transition disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        </div>
        {txns.length === 0 ? (
          <p className="text-ink-500 p-4 text-sm">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-400 text-left text-xs uppercase tracking-wide">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">Payer</th>
                  <th className="px-4 py-2 font-semibold">Program</th>
                  <th className="px-4 py-2 text-right font-semibold">Net</th>
                  <th className="px-4 py-2 font-semibold">Method</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 500).map((t, i) => (
                  <tr key={i} className="border-ink-50 border-t">
                    <td className="text-ink-600 whitespace-nowrap px-4 py-2.5">{t.date.slice(0, 10)}</td>
                    <td className="text-ink-800 px-4 py-2.5">{t.payer}</td>
                    <td className="text-ink-600 px-4 py-2.5">{t.program}</td>
                    <td className="text-ink-900 whitespace-nowrap px-4 py-2.5 text-right font-medium">
                      {money(t.net)}
                      {t.refund > 0 ? (
                        <span className="text-hoop-600 ml-1 text-xs">(−{money(t.refund)})</span>
                      ) : null}
                    </td>
                    <td className="text-ink-600 px-4 py-2.5">{t.method}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                          t.status === "REFUNDED"
                            ? "bg-hoop-50 text-hoop-700"
                            : "bg-court-50 text-court-700"
                        }`}
                      >
                        {t.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txns.length > 500 ? (
              <p className="text-ink-400 px-4 py-2 text-xs">
                Showing the 500 most recent. Export CSV for the full list.
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border-ink-200 rounded-2xl border bg-white p-4">
      <p className="text-ink-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}
