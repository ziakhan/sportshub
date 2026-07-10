"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import RemovePlayerButton from "./remove-player-button"

interface PlayerTeam {
  jerseyNumber: number | null
  joinedAt: string
  team: {
    id: string
    name: string
    ageGroup: string
    tenant: { name: string; slug: string } | null
  }
}

interface Player {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  jerseyNumber: string | null
  teams: PlayerTeam[]
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/players")
        if (!res.ok) throw new Error("Failed to load players")
        const data = await res.json()
        setPlayers(data.players)
      } catch {
        setError("Failed to load players")
      } finally {
        setIsLoading(false)
      }
    }
    loadPlayers()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-500">Loading players...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Players
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-ink-950 text-3xl font-bold">My players</h1>
            <p className="text-ink-500 mt-1 text-sm">
              Player profiles on this account — teams, stats and registrations.
            </p>
          </div>
          <Link
            href="/players/add"
            className="bg-play-600 hover:bg-play-700 inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            Add Player
          </Link>
        </div>
      </div>

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm font-medium">
          {error}
        </div>
      )}

      {players.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-10 text-center">
          <div className="bg-ink-50 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl">
            <IconUsers className="text-ink-500 h-5 w-5" />
          </div>
          <h3 className="font-display text-ink-950 text-xl font-semibold">No players yet</h3>
          <p className="text-ink-500 mx-auto mb-5 mt-2 max-w-lg text-sm">
            Add a player profile to start signing up for tryouts, camps, and team programs.
          </p>
          <Link
            href="/players/add"
            className="bg-play-600 hover:bg-play-700 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-white transition"
          >
            Add your first player
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {players.map((player) => {
            const dob = new Date(player.dateOfBirth)
            const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

            return (
              <div
                key={player.id}
                className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-ink-950 text-xl font-semibold">
                      {player.firstName} {player.lastName}
                    </h3>
                    <div className="text-ink-600 mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      <span className="bg-ink-100 rounded-full px-2 py-1">Age {age}</span>
                      <span className="bg-ink-100 rounded-full px-2 py-1">{player.gender}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
                    <Link href={`/player/${player.id}`} className="text-ink-600 hover:text-ink-950">
                      Stats
                    </Link>
                    <Link href={`/players/${player.id}/edit`} className="text-play-600 hover:text-play-700">
                      Edit
                    </Link>
                    <RemovePlayerButton
                      playerId={player.id}
                      playerName={`${player.firstName} ${player.lastName}`}
                      onRemoved={() => setPlayers((prev) => prev.filter((p) => p.id !== player.id))}
                    />
                  </div>
                </div>

                <div className="border-ink-100 mt-4 border-t pt-3">
                  {player.teams.length > 0 ? (
                    <ul className="space-y-2">
                      {player.teams.map((tp) => (
                        <li key={tp.team.id}>
                          <Link
                            href={`/team/${tp.team.id}`}
                            className="bg-ink-50 hover:bg-play-50 group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition"
                          >
                            <span className="min-w-0">
                              <span className="text-ink-950 group-hover:text-play-700 block truncate text-sm font-semibold">
                                {tp.team.name}
                                {tp.jerseyNumber != null && (
                                  <span className="text-ink-400 ml-1.5 font-normal">
                                    #{tp.jerseyNumber}
                                  </span>
                                )}
                              </span>
                              <span className="text-ink-500 block truncate text-xs">
                                {[tp.team.tenant?.name, tp.team.ageGroup].filter(Boolean).join(" · ")}
                                {tp.joinedAt &&
                                  ` · joined ${new Date(tp.joinedAt).toLocaleDateString("en-CA", { month: "short", year: "numeric" })}`}
                              </span>
                            </span>
                            <svg className="text-ink-300 group-hover:text-play-600 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-ink-400 text-xs">
                      Not on a team yet — accepted offers place players on their team automatically.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  )
}
