"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

/** Approve/reject/withdraw + payment actions — same PATCH the Teams tab uses. */
export function SubmissionActions({
  seasonId,
  submissionId,
  status,
  paymentStatus,
}: {
  seasonId: string
  submissionId: string
  status: string
  paymentStatus: string
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
