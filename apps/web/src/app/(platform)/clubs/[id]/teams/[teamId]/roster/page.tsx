import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { Badge, PanelHeader } from "@/components/ui"
import { FinalizeButton } from "./finalize-button"
import { RosterManager } from "./roster-manager"
import { RosterRowActions } from "./roster-row-actions"
import { WithdrawalRequestsPanel } from "@/components/withdrawal-requests-panel"

interface RosterPlayer {
  id: string
  playerId: string
  status: string
  jerseyNumber: number | null
  uniformSize: string | null
  tracksuitSize: string | null
  shoeSize: string | null
  player: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
    gender: string | null
    position: string | null
    height: string | null
    weight: number | null
  }
}

interface RosterTeam {
  id: string
  name: string
  ageGroup: string
  gender: string | null
  season: string | null
  players: RosterPlayer[]
}

interface RosterOffer {
  id: string
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
  jerseyPref1: number | null
  jerseyPref2: number | null
  jerseyPref3: number | null
  respondedAt: Date | null
  player: { id: string }
}

async function getTeamRoster(teamId: string, tenantId: string): Promise<RosterTeam | null> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      gender: true,
      season: true,
      players: {
        // Released (INACTIVE) players stay visible so they can be reactivated
        where: { status: { in: ["ACTIVE", "INACTIVE"] } },
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              position: true,
              height: true,
              weight: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  })

  return team
}

async function getTeamOffers(teamId: string): Promise<RosterOffer[]> {
  return await prisma.offer.findMany({
    where: { teamId, status: "ACCEPTED" },
    select: {
      id: true,
      uniformSize: true,
      shoeSize: true,
      tracksuitSize: true,
      jerseyPref1: true,
      jerseyPref2: true,
      jerseyPref3: true,
      respondedAt: true,
      player: { select: { id: true } },
    },
    orderBy: { respondedAt: "asc" },
  })
}

export default async function TeamRosterPage({
  params,
}: {
  params: { id: string; teamId: string }
}) {
  const [team, offers, templates, pendingInvitations] = await Promise.all([
    getTeamRoster(params.teamId, params.id),
    getTeamOffers(params.teamId),
    prisma.offerTemplate.findMany({
      where: { tenantId: params.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    (prisma as any).playerInvitation.findMany({
      where: { teamId: params.teamId, status: "PENDING" },
      select: { id: true, invitedEmail: true, playerName: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (!team) {
    return (
      <div className="reveal border-hoop-200 rounded-[28px] border bg-red-50 p-6 text-center">
        <p className="text-hoop-700 font-medium">Team not found.</p>
      </div>
    )
  }

  // Released (INACTIVE) players render in their own section below and never
  // count toward the active roster, jersey logic, or finalization state.
  const activePlayers = team.players.filter((tp) => tp.status === "ACTIVE")
  const releasedPlayers = team.players.filter((tp) => tp.status === "INACTIVE")

  // Club-waiver status per player (owner 2026-07-20): staff see who has
  // signed the club's required waivers straight on the roster.
  const clubWaivers = await (prisma as any).waiverDocument.findMany({
    where: { tenantId: params.id, active: true, required: true },
    select: { id: true, version: true },
  })
  const waiverSignatures =
    clubWaivers.length > 0 && activePlayers.length > 0
      ? await (prisma as any).waiverSignature.findMany({
          where: {
            playerId: { in: activePlayers.map((tp) => tp.playerId) },
            waiverId: { in: clubWaivers.map((w: any) => w.id) },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          select: { playerId: true, waiverId: true, waiverVersion: true },
        })
      : []
  const signedWaiverKeys = new Set(
    waiverSignatures
      .filter((s: any) => {
        const w = clubWaivers.find((w: any) => w.id === s.waiverId)
        return w && s.waiverVersion === w.version
      })
      .map((s: any) => `${s.waiverId}:${s.playerId}`)
  )
  const unsignedCountFor = (playerId: string) =>
    clubWaivers.filter((w: any) => !signedWaiverKeys.has(`${w.id}:${playerId}`)).length

  // Check if there are unfinalized players (accepted offers without jersey numbers)
  const hasUnfinalized = activePlayers.some(
    (tp) => tp.jerseyNumber === null
  )
  const hasAcceptedOffers = offers.length > 0

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clubs/${params.id}/teams/${params.teamId}/dashboard`}
          className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          &larr; Back to Team Dashboard
        </Link>
      </div>

      <div className="reveal mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
            {team.name} - Roster
          </h2>
          <p className="text-sm text-ink-500 mt-2 font-medium">
            {team.ageGroup}{team.gender ? ` ${team.gender}` : ""}
            {team.season ? ` - ${team.season}` : ""}
          </p>
        </div>
        {hasAcceptedOffers && hasUnfinalized && (
          <FinalizeButton teamId={team.id} teamName={team.name} />
        )}
      </div>

      {/* Families asking for a release — the club signs off (owner 2026-07-18) */}
      <WithdrawalRequestsPanel teamId={team.id} />

      <RosterManager
        teamId={team.id}
        templates={templates}
        pendingInvitations={pendingInvitations.map((i: any) => ({
          id: i.id,
          email: i.invitedEmail,
          playerName: i.playerName,
        }))}
      />

      {activePlayers.length === 0 ? (
        <div
          className="reveal rounded-[28px] border border-dashed border-ink-300 bg-white p-12 text-center shadow-soft"
          style={{ animationDelay: "140ms" }}
        >
          <h3 className="font-condensed text-ink-950 mb-2 text-xl font-bold uppercase tracking-wide">
            No players on roster
          </h3>
          <p className="text-ink-600">
            Players will appear here once they accept their offers.
          </p>
        </div>
      ) : (
        <div
          className="reveal overflow-hidden rounded-[28px] border border-ink-100 bg-white shadow-soft"
          style={{ animationDelay: "140ms" }}
        >
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100">
            <thead className="bg-ink-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Height / Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Uniform
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Tracksuit
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Shoes
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Status
                </th>
                {clubWaivers.length > 0 && (
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Waivers
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {activePlayers.map((tp) => {
                const offer = offers.find((o) => o.player.id === tp.playerId)

                return (
                  <tr key={tp.id} className="transition-colors hover:bg-ink-50/60">
                    <td className="whitespace-nowrap px-6 py-4">
                      {tp.jerseyNumber !== null ? (
                        <span className="font-condensed inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-base font-bold text-[color:var(--brand-ink)]">
                          {tp.jerseyNumber}
                        </span>
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-sm text-ink-400">
                          -
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-ink-900">
                        <Link href={`/player/${tp.player.id}`} className="hover:text-[color:var(--brand-ink)] transition-colors">
                          {tp.player.firstName} {tp.player.lastName}
                        </Link>
                      </div>
                      <div className="text-xs text-ink-500">{tp.player.gender}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {tp.player.position || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {tp.player.height || "-"} / {tp.player.weight ? `${tp.player.weight} lbs` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {tp.uniformSize || offer?.uniformSize || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {tp.tracksuitSize || offer?.tracksuitSize || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {tp.shoeSize || offer?.shoeSize || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {tp.jerseyNumber !== null ? (
                        <Badge tone="court">Finalized</Badge>
                      ) : (
                        <Badge tone="gold">Pending finalization</Badge>
                      )}
                    </td>
                    {clubWaivers.length > 0 && (
                      <td className="whitespace-nowrap px-6 py-4">
                        {unsignedCountFor(tp.playerId) === 0 ? (
                          <Badge tone="court">Signed</Badge>
                        ) : (
                          <Badge tone="warning">
                            {unsignedCountFor(tp.playerId)} unsigned
                          </Badge>
                        )}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-6 py-4">
                      <RosterRowActions
                        teamId={team.id}
                        playerId={tp.playerId}
                        playerName={`${tp.player.firstName} ${tp.player.lastName}`}
                        jerseyNumber={tp.jerseyNumber}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Released players — kept visible so they can be reactivated */}
      {releasedPlayers.length > 0 && (
        <div
          className="reveal border-ink-200 mt-6 overflow-hidden rounded-[28px] border border-dashed bg-white"
          style={{ animationDelay: "220ms" }}
        >
          <div className="bg-ink-50 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-6 py-3.5">
            <span className="font-condensed text-ink-700 text-base font-bold uppercase leading-none tracking-wide">
              Released ({releasedPlayers.length})
            </span>
            <span className="text-ink-400 text-xs">
              Not on the active roster — reactivate to bring a player back.
            </span>
          </div>
          <ul className="divide-ink-100 divide-y">
            {releasedPlayers.map((tp) => (
              <li
                key={tp.id}
                className="hover:bg-ink-50/60 flex items-center justify-between gap-3 px-6 py-3 transition-colors"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="text-ink-500 truncate text-sm font-medium">
                    {tp.player.firstName} {tp.player.lastName}
                  </span>
                  <Badge tone="neutral">Released</Badge>
                </span>
                <RosterRowActions
                  teamId={team.id}
                  playerId={tp.playerId}
                  playerName={`${tp.player.firstName} ${tp.player.lastName}`}
                  jerseyNumber={tp.jerseyNumber}
                  status={tp.status}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Jersey Preferences Summary */}
      {offers.length > 0 && hasUnfinalized && (
        <div
          className="reveal mt-6 rounded-[28px] border border-ink-100 bg-white p-6 shadow-soft"
          style={{ animationDelay: "300ms" }}
        >
          <PanelHeader title="Jersey Preferences (Accepted Offers)" />
          <div className="space-y-2">
            {offers.map((offer) => {
              const tp = team.players.find((p) => p.playerId === offer.player.id)
              const player = tp?.player
              if (!player || tp?.jerseyNumber !== null) return null

              return (
                <div
                  key={offer.id}
                  className="hover:bg-ink-50/60 flex items-center justify-between rounded-xl px-2 py-1.5 text-sm transition-colors"
                >
                  <span className="text-ink-700 font-medium">{player.firstName} {player.lastName}</span>
                  <span className="text-ink-500">
                    Prefs: {[offer.jerseyPref1, offer.jerseyPref2, offer.jerseyPref3]
                      .filter((n) => n !== null)
                      .map((n) => `#${n}`)
                      .join(", ")}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
