import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import {
  actorRoleAtTenant,
  canActOnTeam,
  coachedTeamIds,
  isClubAdmin,
  isClubStaff,
} from "@/lib/authz/team-scope"
import { auditSafe } from "@/lib/audit"
import { notifySafe } from "@/lib/notifications"
import { appBaseUrl, escapeHtml, sendEmail, transactionalFooter } from "@/lib/email"
import { createOfferForPlayer, OfferCreationError, resolveOfferTerms } from "@/lib/offers/create-offer"
import {
  offerKey,
  poolOfferIndex,
  rosterOnAssignment,
  syncPoolFromEvent,
  type PoolOffer,
} from "@/lib/tryouts/pool"

export const dynamic = "force-dynamic"

/**
 * The age-group pool console (docs/roadmap/club-tryouts-and-age-pools).
 *
 * The pool is the centre of gravity: kids land in it from tryout sessions and
 * stay there until a person puts them on a team. Offer state and assignment
 * are orthogonal, "accepted but unassigned" is a normal resting state, and
 * assignment is a free market inside the club (owner rulings 2026-08-20) —
 * any club staff may place any member on any club team, first write wins, and
 * the platform imposes no authority policy. What it does impose is a trail.
 */

const DEFAULT_OFFER_DAYS = 14

function birthYear(dateOfBirth: Date | null): number | null {
  return dateOfBirth ? dateOfBirth.getFullYear() : null
}

/**
 * GET /api/clubs/[id]/tryout-pool?seasonLabel=&ageGroup=
 * Members, their offer state, their team tag, plus the filter lists and the
 * club's teams so the console can be driven from one call.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubStaff(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const seasonLabel = sp.get("seasonLabel")?.trim() || undefined
    const ageGroup = sp.get("ageGroup")?.trim() || undefined

    const where: any = { tenantId: params.id }
    if (seasonLabel) where.seasonLabel = seasonLabel
    if (ageGroup) where.ageGroup = ageGroup

    const [members, seasonRows, ageRows, teams] = await Promise.all([
      (prisma as any).tryoutPoolMember.findMany({
        where,
        select: {
          id: true,
          seasonLabel: true,
          ageGroup: true,
          playerId: true,
          teamId: true,
          assignedAt: true,
          assignedById: true,
          createdAt: true,
          player: {
            select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
          },
          team: { select: { id: true, name: true } },
          signup: {
            select: {
              id: true,
              status: true,
              checkedInAt: true,
              tryout: {
                select: {
                  id: true,
                  title: true,
                  ageGroup: true,
                  scheduledAt: true,
                  location: true,
                  event: { select: { id: true, title: true } },
                },
              },
            },
          },
          releaseRequests: {
            where: { status: "PENDING" },
            select: {
              id: true,
              kind: true,
              status: true,
              createdAt: true,
              requestedById: true,
              holdingTeam: { select: { id: true, name: true } },
              requestingTeam: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: [{ ageGroup: "asc" }, { createdAt: "asc" }],
      }),
      (prisma as any).tryoutPoolMember.groupBy({
        by: ["seasonLabel"],
        where: { tenantId: params.id },
        _count: { _all: true },
      }),
      (prisma as any).tryoutPoolMember.groupBy({
        by: ["ageGroup"],
        where: { tenantId: params.id, ...(seasonLabel ? { seasonLabel } : {}) },
        _count: { _all: true },
      }),
      prisma.team.findMany({
        where: { tenantId: params.id, archivedAt: null },
        select: { id: true, name: true, ageGroup: true, gender: true, season: true },
        orderBy: [{ ageGroup: "asc" }, { name: "asc" }],
      }),
    ])

    const offers = await poolOfferIndex(prisma, {
      tenantId: params.id,
      playerIds: members.map((m: any) => m.playerId),
    })

    // Cross-team privacy line (owner ruling 7): an assigned player shows name
    // and team to everyone else in the club, and nothing more. Club admins see
    // the whole pool, and a coach sees their own players in full.
    const admin = await isClubAdmin(auth.userId, params.id)
    const myTeams = admin ? null : new Set(await coachedTeamIds(auth.userId, params.id))

    const shaped = members.map((member: any) => {
      const tag = member.team ? { id: member.team.id, name: member.team.name } : null
      const base = {
        id: member.id,
        seasonLabel: member.seasonLabel,
        ageGroup: member.ageGroup,
        player: {
          id: member.player.id,
          firstName: member.player.firstName,
          lastName: member.player.lastName,
        },
        assignedTeam: tag,
        assignedAt: member.assignedAt,
      }
      const inTheOpen = admin || !member.teamId || myTeams?.has(member.teamId)
      if (!inTheOpen) return { ...base, redacted: true }

      const offer = offers.get(offerKey(member.ageGroup, member.playerId))
      return {
        ...base,
        redacted: false,
        player: { ...base.player, birthYear: birthYear(member.player.dateOfBirth), gender: member.player.gender },
        assignedById: member.assignedById,
        offer: offer ? { id: offer.id, status: offer.status, seasonFee: offer.seasonFee, expiresAt: offer.expiresAt } : null,
        offerState: offer?.status ?? "none",
        source: member.signup
          ? {
              signupId: member.signup.id,
              signupStatus: member.signup.status,
              checkedInAt: member.signup.checkedInAt,
              sessionId: member.signup.tryout.id,
              sessionTitle: member.signup.tryout.title,
              scheduledAt: member.signup.tryout.scheduledAt,
              location: member.signup.tryout.location,
              eventId: member.signup.tryout.event?.id ?? null,
              eventTitle: member.signup.tryout.event?.title ?? null,
            }
          : null,
        releaseRequests: member.releaseRequests,
        addedAt: member.createdAt,
      }
    })

    // Team count is decided late off these numbers (owner ruling 5), so the
    // accepted-per-age-group tally is part of the payload, not the client's job.
    const counts: Record<string, { total: number; accepted: number; assigned: number; unassigned: number; offered: number }> = {}
    for (const member of members) {
      const bucket = (counts[member.ageGroup] ??= {
        total: 0,
        accepted: 0,
        assigned: 0,
        unassigned: 0,
        offered: 0,
      })
      const state = offers.get(offerKey(member.ageGroup, member.playerId))?.status ?? "none"
      bucket.total += 1
      if (state === "ACCEPTED") bucket.accepted += 1
      if (state === "PENDING") bucket.offered += 1
      if (member.teamId) bucket.assigned += 1
      else bucket.unassigned += 1
    }

    return NextResponse.json({
      members: shaped,
      counts,
      seasonLabels: seasonRows
        .map((r: any) => ({ seasonLabel: r.seasonLabel, count: r._count._all }))
        .sort((a: any, b: any) => b.seasonLabel.localeCompare(a.seasonLabel)),
      ageGroups: ageRows
        .map((r: any) => ({ ageGroup: r.ageGroup, count: r._count._all }))
        .sort((a: any, b: any) => a.ageGroup.localeCompare(b.ageGroup)),
      teams,
      filters: { seasonLabel: seasonLabel ?? null, ageGroup: ageGroup ?? null },
    })
  } catch (error) {
    console.error("Get tryout pool error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const syncSchema = z.object({ action: z.literal("sync-from-event"), eventId: z.string().uuid() })
const addSchema = z.object({
  action: z.literal("add"),
  playerId: z.string().uuid(),
  seasonLabel: z.string().trim().min(1).max(60),
  ageGroup: z.string().trim().min(1).max(20),
})
const sendOffersSchema = z.object({
  action: z.literal("send-offers"),
  memberIds: z.array(z.string().uuid()).min(1).max(200),
  templateId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(120).optional(),
  message: z.string().trim().max(2000).optional(),
})
const assignSchema = z.object({
  action: z.literal("assign"),
  memberId: z.string().uuid(),
  teamId: z.string().uuid(),
})
const unassignSchema = z.object({ action: z.literal("unassign"), memberId: z.string().uuid() })
const finalizeSchema = z.object({ action: z.literal("finalize-team"), teamId: z.string().uuid() })
const requestReleaseSchema = z.object({
  action: z.literal("request-release"),
  poolMemberId: z.string().uuid(),
  kind: z.enum(["RELEASE_TO_POOL", "TRANSFER"]),
  requestingTeamId: z.string().uuid().optional(),
  message: z.string().trim().max(500).optional(),
})
const resolveReleaseSchema = z.object({
  action: z.literal("resolve-release"),
  requestId: z.string().uuid(),
  resolution: z.enum(["accept", "decline"]),
})

const poolActionSchema = z.discriminatedUnion("action", [
  syncSchema,
  addSchema,
  sendOffersSchema,
  assignSchema,
  unassignSchema,
  finalizeSchema,
  requestReleaseSchema,
  resolveReleaseSchema,
])

/** The member with everything the mutations need. */
async function loadMember(tenantId: string, memberId: string) {
  return (prisma as any).tryoutPoolMember.findFirst({
    where: { id: memberId, tenantId },
    select: {
      id: true,
      tenantId: true,
      seasonLabel: true,
      ageGroup: true,
      playerId: true,
      teamId: true,
      assignedAt: true,
      player: { select: { id: true, firstName: true, lastName: true, parentId: true } },
      team: { select: { id: true, name: true } },
    },
  })
}

/**
 * Take the player off the team they were assigned to. The roster row is only
 * released when it appeared WITH the assignment (joinedAt at or after it) —
 * a row from an earlier season or an earlier manual add is not this feature's
 * to retire, so it is left alone and reported.
 */
async function clearAssignment(
  tx: any,
  member: { id: string; playerId: string; teamId: string | null; assignedAt: Date | null }
): Promise<{ rosterReleased: boolean; rosterLeftAlone: boolean }> {
  let rosterReleased = false
  let rosterLeftAlone = false
  if (member.teamId) {
    const rosterRow = await tx.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId: member.teamId, playerId: member.playerId } },
      select: { id: true, status: true, joinedAt: true },
    })
    if (rosterRow && rosterRow.status === "ACTIVE") {
      const cameWithAssignment =
        !!member.assignedAt && rosterRow.joinedAt.getTime() >= member.assignedAt.getTime() - 1000
      if (cameWithAssignment) {
        await tx.teamPlayer.update({
          where: { id: rosterRow.id },
          data: { status: "INACTIVE", leftAt: new Date() },
        })
        rosterReleased = true
      } else {
        rosterLeftAlone = true
      }
    }
  }
  await tx.tryoutPoolMember.update({
    where: { id: member.id },
    data: { teamId: null, assignedAt: null, assignedById: null },
  })
  return { rosterReleased, rosterLeftAlone }
}

/**
 * POST /api/clubs/[id]/tryout-pool — every pool mutation.
 * Filling the pool and sending offers are admin work (money and selection);
 * assignment, release and finalization are open to any club staff, which is
 * the free market the owner asked for.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubStaff(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const admin = await isClubAdmin(auth.userId, params.id)
    const actorRole = await actorRoleAtTenant(auth.userId, params.id)
    const parsed = poolActionSchema.parse(await request.json())

    const adminOnly = ["sync-from-event", "add", "send-offers"]
    if (adminOnly.includes(parsed.action) && !admin) {
      return NextResponse.json(
        { error: "Only club owners and managers can do that", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    if (parsed.action === "sync-from-event") {
      const event = await (prisma as any).tryoutEvent.findFirst({
        where: { id: parsed.eventId, tenantId: params.id },
        select: { id: true, tenantId: true, seasonLabel: true, title: true },
      })
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

      const result = await syncPoolFromEvent(prisma, event)
      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_POOL_SYNC",
        resource: "TryoutEvent",
        resourceId: event.id,
        tenantId: params.id,
        metadata: { seasonLabel: event.seasonLabel, ...result },
        request,
      })
      return NextResponse.json({ success: true, ...result })
    }

    if (parsed.action === "add") {
      const player = await prisma.player.findUnique({
        where: { id: parsed.playerId },
        select: { id: true, firstName: true, lastName: true },
      })
      if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

      const existing = await (prisma as any).tryoutPoolMember.findFirst({
        where: {
          tenantId: params.id,
          seasonLabel: parsed.seasonLabel,
          ageGroup: parsed.ageGroup,
          playerId: parsed.playerId,
        },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(
          {
            error: `${player.firstName} ${player.lastName} is already in the ${parsed.ageGroup} pool`,
            code: "ALREADY_IN_POOL",
            id: existing.id,
          },
          { status: 409 }
        )
      }

      const member = await (prisma as any).tryoutPoolMember.create({
        data: {
          tenantId: params.id,
          seasonLabel: parsed.seasonLabel,
          ageGroup: parsed.ageGroup,
          playerId: parsed.playerId,
        },
        select: { id: true },
      })
      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_POOL_ADD",
        resource: "TryoutPoolMember",
        resourceId: member.id,
        tenantId: params.id,
        metadata: {
          playerId: parsed.playerId,
          seasonLabel: parsed.seasonLabel,
          ageGroup: parsed.ageGroup,
        },
        request,
      })
      return NextResponse.json({ success: true, id: member.id }, { status: 201 })
    }

    if (parsed.action === "send-offers") {
      const club = await prisma.tenant.findUnique({
        where: { id: params.id },
        select: { name: true },
      })
      if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 })

      const members = await (prisma as any).tryoutPoolMember.findMany({
        where: { id: { in: parsed.memberIds }, tenantId: params.id },
        select: {
          id: true,
          ageGroup: true,
          playerId: true,
          signupId: true,
          player: { select: { id: true, parentId: true, firstName: true, lastName: true } },
        },
      })

      // Terms are snapshotted from the club-level template exactly the way a
      // team offer snapshots one — same resolver, same columns.
      const { terms, templateId } = await resolveOfferTerms(prisma, {
        tenantId: params.id,
        templateId: parsed.templateId,
      })
      const expiresAt = new Date(
        Date.now() + (parsed.expiresInDays ?? DEFAULT_OFFER_DAYS) * 24 * 60 * 60 * 1000
      )
      const live = await poolOfferIndex(prisma, {
        tenantId: params.id,
        playerIds: members.map((m: any) => m.playerId),
      })

      const sent: Array<{ memberId: string; offerId: string; playerName: string; parentId: string }> = []
      const skipped: Array<{ memberId: string; playerName: string | null; reason: string }> = []

      for (const memberId of parsed.memberIds) {
        const member = members.find((m: any) => m.id === memberId)
        if (!member) {
          skipped.push({ memberId, playerName: null, reason: "Not in this club's pool" })
          continue
        }
        const playerName = `${member.player.firstName} ${member.player.lastName}`
        const existing = live.get(offerKey(member.ageGroup, member.playerId))
        if (existing && (existing.status === "PENDING" || existing.status === "ACCEPTED")) {
          skipped.push({
            memberId,
            playerName,
            reason: existing.status === "PENDING" ? "Already has a live offer" : "Already accepted an offer",
          })
          continue
        }

        try {
          const offer = await prisma.$transaction(async (tx: any) =>
            createOfferForPlayer(tx, {
              teamId: null,
              tenantId: params.id,
              ageGroup: member.ageGroup,
              playerId: member.playerId,
              tryoutSignupId: member.signupId,
              templateId,
              terms,
              message: parsed.message,
              expiresAt,
              player: member.player,
              clubName: club.name,
            })
          )
          sent.push({
            memberId,
            offerId: offer.id,
            playerName,
            parentId: member.player.parentId,
          })
        } catch (error) {
          if (error instanceof OfferCreationError) {
            skipped.push({ memberId, playerName, reason: error.message })
          } else {
            console.error("Pool offer row error:", error)
            skipped.push({ memberId, playerName, reason: "Could not send, try again" })
          }
        }
      }

      if (sent.length > 0) {
        await auditSafe({
          actorId: auth.realUserId,
          actorRole,
          action: "TRYOUT_POOL_OFFERS_SENT",
          resource: "OfferTemplate",
          resourceId: parsed.templateId,
          tenantId: params.id,
          metadata: { sent: sent.length, skipped: skipped.length, offerIds: sent.map((s) => s.offerId).slice(0, 50) },
          request,
        })
      }

      return NextResponse.json({ success: true, sent: sent.length, skipped }, { status: 201 })
    }

    if (parsed.action === "assign") {
      const member = await loadMember(params.id, parsed.memberId)
      if (!member) return NextResponse.json({ error: "Pool member not found" }, { status: 404 })

      const team = await prisma.team.findFirst({
        where: { id: parsed.teamId, tenantId: params.id },
        select: { id: true, name: true },
      })
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

      if (member.teamId) {
        return NextResponse.json(
          {
            error: `${member.player.firstName} ${member.player.lastName} is already with ${member.team?.name ?? "another team"}. Ask that team to release them.`,
            code: "ALREADY_ASSIGNED",
            holdingTeam: member.team,
          },
          { status: 409 }
        )
      }

      const offer = (
        await poolOfferIndex(prisma, {
          tenantId: params.id,
          playerIds: [member.playerId],
          ageGroups: [member.ageGroup],
        })
      ).get(offerKey(member.ageGroup, member.playerId))

      const result = await prisma.$transaction(async (tx: any) => {
        // First write wins (owner ruling 6): the where clause carries the
        // "still unassigned" condition, so two coaches racing cannot both win.
        const claimed = await tx.tryoutPoolMember.updateMany({
          where: { id: member.id, teamId: null },
          data: { teamId: team.id, assignedAt: new Date(), assignedById: auth.userId },
        })
        if (claimed.count === 0) return { won: false, rostered: false }
        const rostered = await rosterOnAssignment(tx, {
          teamId: team.id,
          playerId: member.playerId,
          offer,
        })
        return { won: true, rostered }
      })

      if (!result.won) {
        const holder = await loadMember(params.id, parsed.memberId)
        return NextResponse.json(
          {
            error: `${member.player.firstName} ${member.player.lastName} was just picked up by ${holder?.team?.name ?? "another team"}.`,
            code: "ALREADY_ASSIGNED",
            holdingTeam: holder?.team ?? null,
          },
          { status: 409 }
        )
      }

      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_POOL_ASSIGN",
        resource: "TryoutPoolMember",
        resourceId: member.id,
        tenantId: params.id,
        metadata: {
          playerId: member.playerId,
          teamId: team.id,
          teamName: team.name,
          ageGroup: member.ageGroup,
          offerStatus: offer?.status ?? "none",
          rosterAdded: result.rostered,
        },
        request,
      })

      return NextResponse.json({
        success: true,
        team,
        rosterAdded: result.rostered,
        // Families hear at finalization, never on the shuffle (owner ruling 8).
        message: result.rostered
          ? `${member.player.firstName} is on ${team.name} and added to the roster.`
          : `${member.player.firstName} is on ${team.name}. The roster spot follows the accepted offer.`,
      })
    }

    if (parsed.action === "unassign") {
      const member = await loadMember(params.id, parsed.memberId)
      if (!member) return NextResponse.json({ error: "Pool member not found" }, { status: 404 })
      if (!member.teamId) {
        return NextResponse.json(
          { error: "That player is already in the pool", code: "NOT_ASSIGNED" },
          { status: 400 }
        )
      }
      if (!(await canActOnTeam(auth.userId, params.id, member.teamId))) {
        return NextResponse.json(
          {
            error: `${member.team?.name ?? "That team"} holds this player. Send a release request instead.`,
            code: "NOT_YOUR_TEAM",
          },
          { status: 403 }
        )
      }

      const previousTeam = member.team
      const result = await prisma.$transaction(async (tx: any) => clearAssignment(tx, member))

      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_POOL_UNASSIGN",
        resource: "TryoutPoolMember",
        resourceId: member.id,
        tenantId: params.id,
        metadata: { playerId: member.playerId, teamId: previousTeam?.id, ...result },
        request,
      })

      return NextResponse.json({
        success: true,
        ...result,
        message: result.rosterLeftAlone
          ? `${member.player.firstName} is back in the pool. Their roster spot on ${previousTeam?.name} predates this assignment, so it was left as it is.`
          : `${member.player.firstName} is back in the pool.`,
      })
    }

    if (parsed.action === "finalize-team") {
      const team = await prisma.team.findFirst({
        where: { id: parsed.teamId, tenantId: params.id },
        select: { id: true, name: true, tenant: { select: { name: true } } },
      })
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
      if (!(await canActOnTeam(auth.userId, params.id, team.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const members = await (prisma as any).tryoutPoolMember.findMany({
        where: { tenantId: params.id, teamId: team.id },
        select: {
          id: true,
          player: { select: { id: true, firstName: true, lastName: true, parentId: true } },
        },
      })

      // One notice per family, however many of their kids made the team
      // (owner ruling 8: the finalized team announces, the shuffle does not).
      const byParent = new Map<string, string[]>()
      for (const member of members) {
        const names = byParent.get(member.player.parentId) ?? []
        names.push(member.player.firstName)
        byParent.set(member.player.parentId, names)
      }

      const parents = byParent.size
        ? await prisma.user.findMany({
            where: { id: { in: [...byParent.keys()] } },
            select: { id: true, email: true, firstName: true },
          })
        : []
      const emailById = new Map(parents.map((p: any) => [p.id, p]))

      for (const [parentId, names] of byParent) {
        const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]
        const isAre = names.length > 1 ? "are" : "is"
        await notifySafe({
          userId: parentId,
          type: "team_roster_final",
          title: `${team.name} roster is set`,
          message: `The ${team.name} roster is set. ${who} ${isAre} on the team.`,
          link: `/team/${team.id}`,
          referenceId: team.id,
          referenceType: "Team",
        })
        const parent: any = emailById.get(parentId)
        if (!parent?.email) continue
        try {
          await sendEmail({
            to: parent.email,
            subject: `${team.name} roster is set`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${escapeHtml(team.name)} roster is set</h2>
                ${parent.firstName ? `<p>Hi ${escapeHtml(parent.firstName)},</p>` : ""}
                <p>The <strong>${escapeHtml(team.name)}</strong> roster is set. <strong>${escapeHtml(who)}</strong> ${isAre} on the team.</p>
                <p>
                  <a href="${appBaseUrl()}/team/${team.id}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                    See the team
                  </a>
                </p>
                ${transactionalFooter(team.tenant?.name)}
              </div>`,
          })
        } catch (mailError) {
          console.error("Team finalize email failed:", parent.email, mailError)
        }
      }

      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_TEAM_FINALIZED",
        resource: "Team",
        resourceId: team.id,
        tenantId: params.id,
        metadata: { players: members.length, families: byParent.size },
        request,
      })

      return NextResponse.json({
        success: true,
        players: members.length,
        familiesNotified: byParent.size,
      })
    }

    if (parsed.action === "request-release") {
      const member = await loadMember(params.id, parsed.poolMemberId)
      if (!member) return NextResponse.json({ error: "Pool member not found" }, { status: 404 })
      if (!member.teamId) {
        return NextResponse.json(
          { error: "That player is already in the pool", code: "NOT_ASSIGNED" },
          { status: 400 }
        )
      }

      let requestingTeam: { id: string; name: string } | null = null
      if (parsed.kind === "TRANSFER") {
        if (!parsed.requestingTeamId) {
          return NextResponse.json(
            { error: "Name the team the player would move to", code: "REQUESTING_TEAM_REQUIRED" },
            { status: 400 }
          )
        }
        requestingTeam = await prisma.team.findFirst({
          where: { id: parsed.requestingTeamId, tenantId: params.id },
          select: { id: true, name: true },
        })
        if (!requestingTeam) return NextResponse.json({ error: "Team not found" }, { status: 404 })
        if (requestingTeam.id === member.teamId) {
          return NextResponse.json(
            { error: "That player is already with that team", code: "SAME_TEAM" },
            { status: 400 }
          )
        }
        if (!(await canActOnTeam(auth.userId, params.id, requestingTeam.id))) {
          return NextResponse.json(
            { error: "You can only ask for a player to join a team you run", code: "NOT_YOUR_TEAM" },
            { status: 403 }
          )
        }
      }

      const pending = await (prisma as any).teamReleaseRequest.findFirst({
        where: { poolMemberId: member.id, status: "PENDING" },
        select: { id: true },
      })
      if (pending) {
        return NextResponse.json(
          {
            error: "There is already a request waiting on this player",
            code: "REQUEST_PENDING",
            id: pending.id,
          },
          { status: 409 }
        )
      }

      const created = await (prisma as any).teamReleaseRequest.create({
        data: {
          tenantId: params.id,
          poolMemberId: member.id,
          kind: parsed.kind,
          holdingTeamId: member.teamId,
          requestingTeamId: requestingTeam?.id ?? null,
          requestedById: auth.userId,
          message: parsed.message ?? null,
        },
        select: { id: true, kind: true, status: true, createdAt: true },
      })

      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_POOL_RELEASE_REQUEST",
        resource: "TeamReleaseRequest",
        resourceId: created.id,
        tenantId: params.id,
        metadata: {
          playerId: member.playerId,
          kind: parsed.kind,
          holdingTeamId: member.teamId,
          requestingTeamId: requestingTeam?.id ?? null,
        },
        request,
      })

      return NextResponse.json({ success: true, request: created }, { status: 201 })
    }

    // resolve-release
    const releaseRequest = await (prisma as any).teamReleaseRequest.findFirst({
      where: { id: parsed.requestId, tenantId: params.id },
      select: {
        id: true,
        kind: true,
        status: true,
        holdingTeamId: true,
        requestingTeamId: true,
        poolMemberId: true,
        holdingTeam: { select: { id: true, name: true } },
        requestingTeam: { select: { id: true, name: true } },
      },
    })
    if (!releaseRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 })
    if (releaseRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `That request was already ${releaseRequest.status.toLowerCase()}`, code: "NOT_PENDING" },
        { status: 400 }
      )
    }
    // The holding team decides. No admin arbitration, by design.
    if (!(await canActOnTeam(auth.userId, params.id, releaseRequest.holdingTeamId))) {
      return NextResponse.json(
        { error: "Only the team holding the player can answer this", code: "NOT_YOUR_TEAM" },
        { status: 403 }
      )
    }

    const member = await loadMember(params.id, releaseRequest.poolMemberId)
    if (!member) return NextResponse.json({ error: "Pool member not found" }, { status: 404 })

    if (parsed.resolution === "decline") {
      await (prisma as any).teamReleaseRequest.update({
        where: { id: releaseRequest.id },
        data: { status: "DECLINED", resolvedById: auth.userId, resolvedAt: new Date() },
      })
      await auditSafe({
        actorId: auth.realUserId,
        actorRole,
        action: "TRYOUT_POOL_RELEASE_RESOLVE",
        resource: "TeamReleaseRequest",
        resourceId: releaseRequest.id,
        tenantId: params.id,
        metadata: { resolution: "declined", playerId: member.playerId },
        request,
      })
      return NextResponse.json({ success: true, status: "DECLINED" })
    }

    const offer = (
      await poolOfferIndex(prisma, {
        tenantId: params.id,
        playerIds: [member.playerId],
        ageGroups: [member.ageGroup],
      })
    ).get(offerKey(member.ageGroup, member.playerId)) as PoolOffer | undefined

    const outcome = await prisma.$transaction(async (tx: any) => {
      const cleared = await clearAssignment(tx, member)
      let movedTo: { id: string; name: string } | null = null
      let rostered = false
      if (releaseRequest.kind === "TRANSFER" && releaseRequest.requestingTeamId) {
        await tx.tryoutPoolMember.update({
          where: { id: member.id },
          data: {
            teamId: releaseRequest.requestingTeamId,
            assignedAt: new Date(),
            assignedById: auth.userId,
          },
        })
        rostered = await rosterOnAssignment(tx, {
          teamId: releaseRequest.requestingTeamId,
          playerId: member.playerId,
          offer,
        })
        movedTo = releaseRequest.requestingTeam
      }
      await tx.teamReleaseRequest.update({
        where: { id: releaseRequest.id },
        data: { status: "ACCEPTED", resolvedById: auth.userId, resolvedAt: new Date() },
      })
      return { ...cleared, movedTo, rostered }
    })

    await auditSafe({
      actorId: auth.realUserId,
      actorRole,
      action: "TRYOUT_POOL_RELEASE_RESOLVE",
      resource: "TeamReleaseRequest",
      resourceId: releaseRequest.id,
      tenantId: params.id,
      metadata: {
        resolution: "accepted",
        kind: releaseRequest.kind,
        playerId: member.playerId,
        from: releaseRequest.holdingTeamId,
        to: outcome.movedTo?.id ?? null,
        ...outcome,
      },
      request,
    })

    return NextResponse.json({
      success: true,
      status: "ACCEPTED",
      movedTo: outcome.movedTo,
      rosterAdded: outcome.rostered,
      rosterReleased: outcome.rosterReleased,
      rosterLeftAlone: outcome.rosterLeftAlone,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Tryout pool action error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
