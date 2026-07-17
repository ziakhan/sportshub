"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StatTile, Button, PanelHeader, Badge } from "@/components/ui"
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
          <h2 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            Parent dashboard
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Players, signups, and payment history in one place.
          </p>
        </div>
        <Button href="/settings/profile" variant="subtle" icon={ICONS.pencil}>
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          value={data.players.length}
          label="Players"
          tone="brand"
          icon={<IconUsers className="h-5 w-5" />}
          delay={0}
        />
        <StatTile
          value={data.tryoutSignups.length}
          label="Tryout signups"
          tone="hoop"
          icon={<IconClipboard className="h-5 w-5" />}
          delay={70}
        />
        <StatTile
          value={activeSignups}
          label="Active signups"
          tone="court"
          icon={<IconBolt className="h-5 w-5" />}
          delay={140}
        />
        <StatTile
          value={data.recentPayments.length}
          label="Payments"
          tone="ink"
          icon={<IconCard className="h-5 w-5" />}
          delay={210}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "260ms" }}
        >
          <PanelHeader
            title="My players"
            action={
              <span className="text-ink-400 text-xs font-semibold">
                {data.players.length} registered
              </span>
            }
          />

          {data.players.length > 0 ? (
            <ul className="space-y-2">
              {data.players.map((player) => (
                <li key={player.id} className="border-ink-100 bg-ink-50 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-ink-900 font-medium">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 text-xs font-semibold">
                      <Link href={`/player/${player.id}`} className="text-ink-500 hover:text-ink-900">
                        Stats
                      </Link>
                      <Link href={`/players/${player.id}/edit`} className="text-play-600 hover:text-play-700">
                        Edit
                      </Link>
                    </div>
                  </div>
                  {player.teams.length > 0 ? (
                    <div className="mt-1.5 space-y-1">
                      {player.teams.map((t) => (
                        <div key={t.team.id} className="flex items-center gap-2 text-xs">
                          <Link
                            href={`/team/${t.team.id}`}
                            className="text-ink-600 hover:text-play-700 flex min-w-0 items-center gap-1.5 font-medium"
                          >
                            <svg className="text-ink-400 h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M3 10 12 4l9 6M5 10v9h14v-9" />
                            </svg>
                            <span className="truncate">
                              {t.team.name} · {t.team.ageGroup}
                            </span>
                          </Link>
                          <Link
                            href={`/teams/${t.team.id}/chat`}
                            className="text-play-600 hover:text-play-700 flex shrink-0 items-center gap-1 font-semibold"
                          >
                            Chat
                            {(data.unreadChat[t.team.id] ?? 0) > 0 && (
                              <span className="bg-hoop-500 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
                                {data.unreadChat[t.team.id]}
                              </span>
                            )}
                          </Link>
                          <Link
                            href={`/teams/${t.team.id}/polls`}
                            className="text-play-600 hover:text-play-700 shrink-0 font-semibold"
                          >
                            Polls
                          </Link>
                          <Link
                            href={`/teams/${t.team.id}/calendar`}
                            className="text-play-600 hover:text-play-700 shrink-0 font-semibold"
                          >
                            Calendar
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-ink-400 mt-1.5 text-xs">No team yet</div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">No players registered yet.</p>
          )}

          <div className="mt-4">
            <Button href="/players/add" variant="subtle" size="sm" icon={ICONS.plus}>
              Add a player
            </Button>
          </div>
        </div>

        <div
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "320ms" }}
        >
          <PanelHeader
            title="Registrations"
            action={
              <span className="text-ink-400 shrink-0 text-xs font-semibold">
                {data.tryoutSignups.length} tryout{data.tryoutSignups.length !== 1 ? "s" : ""} ·{" "}
                {data.programSignups.length} program{data.programSignups.length !== 1 ? "s" : ""}
              </span>
            }
          />

          {data.tryoutSignups.length > 0 ? (
            <ul className="space-y-2">
              {data.tryoutSignups.map((signup) => (
                <SignupItem key={signup.id} signup={signup} />
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">No tryout signups yet.</p>
          )}

          {data.programSignups.length > 0 && (
            <>
              <p className="text-ink-400 mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.14em]">
                Camps &amp; leagues
              </p>
              <ul className="space-y-2">
                {data.programSignups.map((p) => (
                  <li key={p.id} className="border-ink-100 bg-ink-50 rounded-xl border p-3">
                    <Link href={p.href} className="text-ink-900 font-medium hover:text-play-700">
                      {p.name}
                    </Link>
                    <div className="text-ink-500 text-xs">
                      {p.kind}
                      {p.startDate ? ` · starts ${new Date(p.startDate).toLocaleDateString()}` : ""}
                      {" · "}
                      <span className="text-court-700 font-semibold">{p.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4">
            <Button href="/events" variant="subtle" size="sm" icon={ICONS.grid}>
              Browse programs
            </Button>
          </div>
        </div>

        <div
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "380ms" }}
        >
          <PanelHeader
            title="Recent payments"
            action={
              <span className="text-ink-400 text-xs font-semibold">
                {data.recentPayments.length} transactions
              </span>
            }
          />

          {data.recentPayments.length > 0 ? (
            <ul className="space-y-2">
              {data.recentPayments.map((payment) => (
                <li key={payment.id} className="border-ink-100 bg-ink-50 rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--brand-ink)] text-sm font-bold">
                      ${String(payment.amount)}
                    </span>
                    <Badge tone={payment.status === "SUCCEEDED" ? "success" : "hoop"}>
                      {payment.status}
                    </Badge>
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

/** Unsized icon nodes for kit <Button>s (the Button sizes them per `size`). */
const ICONS = {
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
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
          <Button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            variant="secondary"
            tone="hoop"
            size="sm"
          >
            {cancelling ? "..." : "Cancel"}
          </Button>
        )}
      </div>
    </li>
  )
}
