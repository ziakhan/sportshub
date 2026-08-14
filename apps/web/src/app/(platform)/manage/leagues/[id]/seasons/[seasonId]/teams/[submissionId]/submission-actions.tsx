"use client"

import { useRouter } from "next/navigation"
import { Button, ChipGroup } from "@/components/ui"

/** Approve/reject/withdraw + payment actions — same PATCH the Teams tab uses. */
export function SubmissionActions({
  seasonId,
  submissionId,
  status,
  paymentStatus,
  weekendStyle,
  scheduleRequestsEnabled,
}: {
  seasonId: string
  submissionId: string
  status: string
  paymentStatus: string
  weekendStyle?: string | null
  scheduleRequestsEnabled?: boolean
}) {
  const router = useRouter()
  const patch = async (body: Record<string, string | boolean>, confirmText?: string) => {
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
      <span className="text-ink-600 flex items-center gap-1.5 text-xs">
        Weekend preference
        <ChipGroup
          ariaLabel="Weekend preference"
          value={weekendStyle ?? "NO_PREFERENCE"}
          onChange={(v) => patch({ weekendStyle: v })}
          options={[
            { value: "NO_PREFERENCE", label: "League default" },
            { value: "SAME_DAY", label: "One trip (both games same day)" },
            { value: "SPLIT_DAYS", label: "Split days (Sat + Sun)" },
          ]}
        />
      </span>
      {/* Schedule requests gate (owner 2026-08-01): OFF for everyone; the
          league flips it per team "upon request". */}
      <label className="text-ink-600 flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={!!scheduleRequestsEnabled}
          onChange={(e) => patch({ scheduleRequestsEnabled: e.target.checked })}
          className="accent-play-600"
        />
        Schedule requests
        <span className="text-ink-400">(club can ask for windows/blackouts — approval required, best effort)</span>
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
