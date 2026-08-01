"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

/** Approve/reject/withdraw + payment actions — same PATCH the Teams tab uses. */
export function SubmissionActions({
  seasonId,
  submissionId,
  status,
  paymentStatus,
  weekendStyle,
}: {
  seasonId: string
  submissionId: string
  status: string
  paymentStatus: string
  weekendStyle?: string | null
}) {
  const router = useRouter()
  const patch = async (body: Record<string, string>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    const res = await fetch(`/api/seasons/${seasonId}/teams/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't update the team")
      return
    }
    router.refresh()
  }
  const paid = ["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(paymentStatus)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <>
          <Button size="sm" tone="court" onClick={() => patch({ status: "APPROVED" })}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" tone="hoop" onClick={() => patch({ status: "REJECTED" })}>
            Reject
          </Button>
        </>
      )}
      {(status === "PENDING" || status === "APPROVED") && (
        <Button
          size="sm"
          variant="subtle"
          onClick={() =>
            patch(
              { status: "WITHDRAWN" },
              "Withdraws the team from the season — future games are cancelled and opponents notified."
            )
          }
        >
          Withdraw
        </Button>
      )}
      {/* Weekend preference (owner 2026-08-01): the team's choice overrides
          the league default when the schedule is generated. */}
      <label className="text-ink-600 flex items-center gap-1.5 text-xs">
        Weekend preference
        <select
          value={weekendStyle ?? "NO_PREFERENCE"}
          onChange={(e) => patch({ weekendStyle: e.target.value })}
          className="border-ink-200 focus:border-play-500 rounded-lg border px-2 py-1 text-xs focus:outline-none"
        >
          <option value="NO_PREFERENCE">League default</option>
          <option value="SAME_DAY">One trip (both games same day)</option>
          <option value="SPLIT_DAYS">Split days (Sat + Sun)</option>
        </select>
      </label>
      {!paid ? (
        <>
          <Button size="sm" variant="secondary" tone="court" onClick={() => patch({ paymentStatus: "PAID_MANUAL" })}>
            Mark paid
          </Button>
          <Button size="sm" variant="subtle" onClick={() => patch({ paymentStatus: "WAIVED" })}>
            Waive fee
          </Button>
        </>
      ) : (
        <Button size="sm" variant="subtle" onClick={() => patch({ paymentStatus: "UNPAID" })}>
          Mark unpaid
        </Button>
      )}
    </div>
  )
}
