"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { DashboardData } from "../get-dashboard-data"

interface ParentSectionProps {
  data: NonNullable<DashboardData["parent"]>
}

export function ParentSection({ data }: ParentSectionProps) {
  const activeSignups = data.tryoutSignups.filter(
    (signup) => signup.status === "PENDING" || signup.status === "CONFIRMED"
  ).length

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-ink-950 text-2xl font-bold">Parent dashboard</h2>
          <p className="text-ink-500 mt-1 text-sm">
            Players, signups, and payment history in one place.
          </p>
        </div>
        <Link
          href="/settings/profile"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold transition"
        >
          Edit Profile
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Players"
          value={data.players.length}
          tone="bg-play-50 text-play-700"
          icon={<IconUsers className="h-4 w-4" />}
        />
        <MetricCard
          label="Tryout signups"
          value={data.tryoutSignups.length}
          tone="bg-hoop-50 text-hoop-700"
          icon={<IconClipboard className="h-4 w-4" />}
        />
        <MetricCard
          label="Active signups"
          value={activeSignups}
          tone="bg-court-50 text-court-700"
          icon={<IconBolt className="h-4 w-4" />}
        />
        <MetricCard
          label="Payments"
          value={data.recentPayments.length}
          tone="bg-ink-100 text-ink-700"
          icon={<IconCard className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <h3 className="font-display text-ink-950 text-lg font-semibold">My players</h3>
          <p className="text-ink-500 mb-4 mt-1 text-sm">{data.players.length} registered</p>

          {data.players.length > 0 ? (
            <ul className="space-y-2">
              {data.players.map((player) => (
                <li key={player.id}>
                  <Link
                    href={`/players/${player.id}/edit`}
                    className="border-ink-100 bg-ink-50 hover:border-play-200 hover:bg-play-50 block rounded-xl border p-3 transition"
                  >
                    <div className="text-ink-900 font-medium">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-500 text-xs">
                        {player.teams.length > 0
                          ? player.teams.map((t) => t.team.name).join(", ")
                          : "No team yet"}
                      </span>
                      <span className="text-play-600 text-xs">Edit</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">No players registered yet.</p>
          )}

          <Link
            href="/players/add"
            className="text-play-600 hover:text-play-700 mt-4 inline-flex items-center text-sm font-semibold"
          >
            Add a player
          </Link>
        </div>

        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <h3 className="font-display text-ink-950 text-lg font-semibold">Tryout signups</h3>
          <p className="text-ink-500 mb-4 mt-1 text-sm">{data.tryoutSignups.length} recent</p>

          {data.tryoutSignups.length > 0 ? (
            <ul className="space-y-2">
              {data.tryoutSignups.map((signup) => (
                <SignupItem key={signup.id} signup={signup} />
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">No signups yet.</p>
          )}

          <Link
            href="/marketplace"
            className="text-play-600 hover:text-play-700 mt-4 inline-flex items-center text-sm font-semibold"
          >
            Browse tryouts
          </Link>
        </div>

        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <h3 className="font-display text-ink-950 text-lg font-semibold">Recent payments</h3>
          <p className="text-ink-500 mb-4 mt-1 text-sm">
            {data.recentPayments.length} transactions
          </p>

          {data.recentPayments.length > 0 ? (
            <ul className="space-y-2">
              {data.recentPayments.map((payment) => (
                <li key={payment.id} className="border-ink-100 bg-ink-50 rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-900 text-sm font-semibold">
                      ${String(payment.amount)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        payment.status === "SUCCEEDED" ? "text-court-700" : "text-hoop-700"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div className="text-ink-500 text-xs">
                    {payment.paymentType.replace("_", " ")}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">No payments yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: string
  icon: JSX.Element
}) {
  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
          {label}
        </div>
      </div>
      <div className="font-display text-ink-950 text-3xl font-bold">{value}</div>
    </div>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  )
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
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

  const canCancel = signup.status === "PENDING" || signup.status === "CONFIRMED"

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this signup?")) return

    setCancelling(true)
    try {
      const res = await fetch(`/api/tryouts/${signup.tryout.id}/signup?signupId=${signup.id}`, {
        method: "DELETE",
      })

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
      <li className="border-ink-100 bg-ink-50 rounded-xl border p-3">
        <div className="text-ink-400 font-medium line-through">{signup.tryout.title}</div>
        <div className="text-hoop-700 text-xs font-semibold">CANCELLED</div>
      </li>
    )
  }

  return (
    <li className="border-ink-100 bg-ink-50 rounded-xl border p-3">
      <div className="text-ink-900 font-medium">{signup.tryout.title}</div>
      <div className="flex items-center justify-between">
        <div className="text-ink-500 text-xs">
          {signup.playerName} &middot;{" "}
          <span
            className={
              signup.status === "CONFIRMED"
                ? "text-court-700"
                : signup.status === "PAID"
                  ? "text-play-700"
                  : "text-hoop-700"
            }
          >
            {signup.status}
          </span>
        </div>
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-hoop-600 hover:text-hoop-700 disabled:text-ink-400 text-xs font-semibold"
          >
            {cancelling ? "..." : "Cancel"}
          </button>
        )}
      </div>
    </li>
  )
}
