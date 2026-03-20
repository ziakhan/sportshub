"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { DashboardData } from "../get-dashboard-data"

interface ParentSectionProps {
  data: NonNullable<DashboardData["parent"]>
}

export function ParentSection({ data }: ParentSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👨‍👩‍👧‍👦</span>
          <h2 className="text-xl font-bold text-gray-900">Parent Dashboard</h2>
        </div>
        <Link
          href="/settings/profile"
          className="text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Edit Profile
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* My Players */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            My Players
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            {data.players.length} registered
          </p>

          {data.players.length > 0 ? (
            <ul className="space-y-2">
              {data.players.map((player) => (
                <li key={player.id}>
                  <Link
                    href={`/players/${player.id}/edit`}
                    className="block rounded-md border border-gray-100 bg-gray-50 p-3 transition hover:border-orange-200 hover:bg-orange-50"
                  >
                    <div className="font-medium text-gray-900">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {player.teams.length > 0
                          ? player.teams.map((t) => t.team.name).join(", ")
                          : "No team yet"}
                      </span>
                      <span className="text-xs text-orange-500">Edit</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No players registered yet.</p>
          )}

          <Link
            href="/players/add"
            className="mt-4 inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Add a Player &rarr;
          </Link>
        </div>

        {/* Tryout Signups */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Tryout Signups
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            {data.tryoutSignups.length} recent
          </p>

          {data.tryoutSignups.length > 0 ? (
            <ul className="space-y-2">
              {data.tryoutSignups.map((signup) => (
                <SignupItem key={signup.id} signup={signup} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No signups yet.</p>
          )}

          <Link
            href="/marketplace"
            className="mt-4 inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Browse Tryouts &rarr;
          </Link>
        </div>

        {/* Recent Payments */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Recent Payments
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            {data.recentPayments.length} transactions
          </p>

          {data.recentPayments.length > 0 ? (
            <ul className="space-y-2">
              {data.recentPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      ${String(payment.amount)}
                    </span>
                    <span
                      className={`text-xs ${
                        payment.status === "SUCCEEDED"
                          ? "text-green-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {payment.paymentType.replace("_", " ")}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No payments yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function SignupItem({
  signup,
}: {
  signup: NonNullable<DashboardData["parent"]>["tryoutSignups"][number]
}) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const canCancel =
    signup.status === "PENDING" || signup.status === "CONFIRMED"

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this signup?")) return

    setCancelling(true)
    try {
      const res = await fetch(
        `/api/tryouts/${signup.tryout.id}/signup?signupId=${signup.id}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to cancel")
        return
      }

      setCancelled(true)
      router.refresh()
    } catch {
      alert("Failed to cancel signup")
    } finally {
      setCancelling(false)
    }
  }

  if (cancelled) {
    return (
      <li className="rounded-md border border-gray-100 bg-gray-50 p-3">
        <div className="font-medium text-gray-400 line-through">
          {signup.tryout.title}
        </div>
        <div className="text-xs text-red-500">CANCELLED</div>
      </li>
    )
  }

  return (
    <li className="rounded-md border border-gray-100 bg-gray-50 p-3">
      <div className="font-medium text-gray-900">{signup.tryout.title}</div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {signup.playerName} &middot;{" "}
          <span
            className={
              signup.status === "CONFIRMED"
                ? "text-green-600"
                : signup.status === "PAID"
                  ? "text-orange-600"
                  : "text-yellow-600"
            }
          >
            {signup.status}
          </span>
        </div>
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:text-gray-400"
          >
            {cancelling ? "..." : "Cancel"}
          </button>
        )}
      </div>
    </li>
  )
}
