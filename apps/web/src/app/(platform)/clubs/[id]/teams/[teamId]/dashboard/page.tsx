"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

export default function TeamDashboardPage() {
  const params = useParams()
  const clubId = params?.id as string
  const teamId = params?.teamId as string
  const [team, setTeam] = useState<any>(null)
  const [tryouts, setTryouts] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [teamRes, tryoutsRes, offersRes, templatesRes] = await Promise.all([
          fetch(`/api/teams/${teamId}`),
          fetch(`/api/tryouts?tenantId=${clubId}`),
          fetch(`/api/offers?teamId=${teamId}`),
          fetch(`/api/teams/${teamId}/offer-templates`),
        ])

        const teamData = await teamRes.json()
        const tryoutsData = await tryoutsRes.json()
        const offersData = await offersRes.json()
        const templatesData = await templatesRes.json()

        setTeam(teamData)
        // Filter tryouts linked to this team
        setTryouts((tryoutsData.tryouts || []).filter((t: any) => t.teamId === teamId || t.team?.id === teamId))
        setOffers(offersData.offers || [])
        setTemplates(templatesData.templates || [])
      } catch {}
      setLoading(false)
    }
    fetchAll()
  }, [clubId, teamId])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>
  if (!team) return <div className="text-gray-500 py-12 text-center">Team not found.</div>

  const pendingOffers = offers.filter((o: any) => o.status === "PENDING")
  const acceptedOffers = offers.filter((o: any) => o.status === "ACCEPTED")
  const players = team.players || []

  return (
    <div>
      <div className="mb-6">
        <Link href={`/clubs/${clubId}/teams`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to Teams
        </Link>
      </div>

      {/* Team Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
          <p className="text-sm text-gray-500">
            {team.ageGroup}
            {team.gender ? ` \u2022 ${team.gender}` : ""}
            {team.season ? ` \u2022 ${team.season}` : ""}
          </p>
          {/* Staff / Coaches */}
          {team.staff && team.staff.filter((s: any) => s.teamId === teamId).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {team.staff.filter((s: any) => s.teamId === teamId).map((s: any) => (
                <span key={s.id} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  s.designation === "HeadCoach" ? "bg-blue-100 text-blue-700" :
                  s.designation === "AssistantCoach" ? "bg-green-100 text-green-700" :
                  s.role === "TeamManager" ? "bg-purple-100 text-purple-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {s.user?.firstName} {s.user?.lastName}
                  {" \u2022 "}
                  {s.designation === "HeadCoach" ? "Head Coach" :
                   s.designation === "AssistantCoach" ? "Asst. Coach" :
                   s.role === "TeamManager" ? "Manager" : s.role}
                </span>
              ))}
            </div>
          )}
          {team.description && <p className="text-sm text-gray-600 mt-2">{team.description}</p>}
        </div>
        <Link href={`/clubs/${clubId}/teams/${teamId}/edit`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Edit Team
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{players.length}</div>
          <div className="text-xs text-gray-500">Players</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{tryouts.length}</div>
          <div className="text-xs text-gray-500">Tryouts</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{offers.length}</div>
          <div className="text-xs text-gray-500">Offers</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{templates.length}</div>
          <div className="text-xs text-gray-500">Templates</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roster */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Roster ({players.length})</h3>
            <Link href={`/clubs/${clubId}/teams/${teamId}/roster`}
              className="text-xs text-blue-600 hover:underline">View Full Roster</Link>
          </div>
          {players.length === 0 ? (
            <p className="text-sm text-gray-500">No players on roster yet. Send offers from tryout signups.</p>
          ) : (
            <div className="space-y-2">
              {players.slice(0, 8).map((tp: any) => (
                <div key={tp.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {tp.jerseyNumber !== null && (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {tp.jerseyNumber}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {tp.player?.firstName} {tp.player?.lastName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{tp.player?.position || ""}</span>
                </div>
              ))}
              {players.length > 8 && (
                <p className="text-xs text-gray-400 text-center">+{players.length - 8} more</p>
              )}
            </div>
          )}
        </div>

        {/* Tryouts */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tryouts ({tryouts.length})</h3>
            <Link href={`/clubs/${clubId}/tryouts/create`}
              className="text-xs text-blue-600 hover:underline">Create Tryout</Link>
          </div>
          {tryouts.length === 0 ? (
            <p className="text-sm text-gray-500">No tryouts linked to this team.</p>
          ) : (
            <div className="space-y-2">
              {tryouts.map((tryout: any) => {
                const isPast = new Date(tryout.scheduledAt) < new Date()
                return (
                  <Link key={tryout.id} href={`/clubs/${clubId}/tryouts/${tryout.id}/signups`}
                    className="block rounded-md bg-gray-50 px-3 py-2 hover:bg-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{tryout.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isPast ? "bg-gray-100 text-gray-600" :
                        tryout.isPublished ? "bg-green-100 text-green-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {isPast ? "Past" : tryout.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(tryout.scheduledAt), "MMM d, yyyy")}
                      {" \u2022 "}{tryout._count?.signups || 0} signups
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Offers */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Offers ({offers.length})</h3>
            <Link href={`/clubs/${clubId}/offers`}
              className="text-xs text-blue-600 hover:underline">View All Offers</Link>
          </div>
          {offers.length === 0 ? (
            <p className="text-sm text-gray-500">No offers sent for this team yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex gap-3 mb-3">
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {pendingOffers.length} pending
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {acceptedOffers.length} accepted
                </span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {offers.filter((o: any) => o.status === "DECLINED").length} declined
                </span>
              </div>
              {offers.slice(0, 6).map((offer: any) => (
                <div key={offer.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-900">
                    {offer.player?.firstName} {offer.player?.lastName}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    offer.status === "ACCEPTED" ? "bg-green-100 text-green-700" :
                    offer.status === "DECLINED" ? "bg-red-100 text-red-700" :
                    offer.status === "EXPIRED" ? "bg-gray-100 text-gray-600" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {offer.status.toLowerCase()}
                  </span>
                </div>
              ))}
              {offers.length > 6 && (
                <p className="text-xs text-gray-400 text-center">+{offers.length - 6} more</p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/clubs/${clubId}/teams/${teamId}/roster`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              <div className="text-lg mb-1">📋</div>
              Roster
            </Link>
            <Link href={`/clubs/${clubId}/teams/${teamId}/offer-templates`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              <div className="text-lg mb-1">📝</div>
              Offer Templates
            </Link>
            <Link href={`/clubs/${clubId}/teams/${teamId}/edit`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              <div className="text-lg mb-1">⚙️</div>
              Edit Team
            </Link>
            <Link href={`/clubs/${clubId}/tryouts/create`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              <div className="text-lg mb-1">🏀</div>
              New Tryout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
