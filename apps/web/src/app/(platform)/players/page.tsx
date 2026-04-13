"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface Player {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  jerseyNumber: string | null
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
              Manage profiles before registering for tryouts and teams.
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
            Add your child to start signing up for tryouts, camps, and team programs.
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
              <Link
                key={player.id}
                href={`/players/${player.id}/edit`}
                className="border-ink-100 shadow-soft hover:border-play-200 hover:bg-play-50 block rounded-2xl border bg-white p-5 transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-ink-950 text-xl font-semibold">
                      {player.firstName} {player.lastName}
                    </h3>
                    <div className="text-ink-600 mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      <span className="bg-ink-100 rounded-full px-2 py-1">Age {age}</span>
                      <span className="bg-ink-100 rounded-full px-2 py-1">{player.gender}</span>
                      {player.jerseyNumber && (
                        <span className="bg-ink-100 rounded-full px-2 py-1">
                          #{player.jerseyNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-play-600 text-sm font-semibold">Edit</span>
                </div>
              </Link>
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
