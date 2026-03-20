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
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading players...</p>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Players</h1>
          <Link
            href="/players/add"
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Add Player
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {players.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
            <div className="mb-2 text-4xl">🏀</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              No Players Yet
            </h3>
            <p className="mb-4 text-gray-600">
              Add your child so you can sign them up for tryouts and teams.
            </p>
            <Link
              href="/players/add"
              className="inline-block rounded-md bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600"
            >
              Add Your First Player
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => {
              const dob = new Date(player.dateOfBirth)
              const age = Math.floor(
                (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
              )

              return (
                <Link
                  key={player.id}
                  href={`/players/${player.id}/edit`}
                  className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {player.firstName} {player.lastName}
                      </h3>
                      <div className="mt-1 flex gap-3 text-sm text-gray-500">
                        <span>Age {age}</span>
                        <span>&middot;</span>
                        <span>{player.gender}</span>
                        {player.jerseyNumber && (
                          <>
                            <span>&middot;</span>
                            <span>#{player.jerseyNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-orange-600">
                      Edit &rarr;
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
