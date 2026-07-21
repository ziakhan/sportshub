import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { sendWaiversForApprovedSubmission } from "@/lib/waivers/auto-send"

export const dynamic = "force-dynamic"

async function leagueSideAccess(userId: string, isPlatformAdmin: boolean, seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      label: true,
      leagueId: true,
      league: { select: { id: true, name: true, ownerId: true } },
    },
  })
  if (!season) return { season: null, allowed: false }
  if (season.league.ownerId === userId || isPlatformAdmin) return { season, allowed: true }
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  return { season, allowed: !!role }
}

/**
 * GET /api/seasons/[id]/waiver-status — league-side signed/outstanding grid:
 * every approved team's roster players against the league's required waivers.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { season, allowed } = await leagueSideAccess(
      sessionInfo.userId,
      sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const waivers = await (prisma as any).waiverDocument.findMany({
      where: { leagueId: season.leagueId, active: true, required: true },
      select: { id: true, title: true, type: true, version: true, annualRenewal: true },
      orderBy: { createdAt: "asc" },
    })

    const submissions = await (prisma as any).teamSubmission.findMany({
      where: { seasonId: params.id, status: "APPROVED" },
      select: {
        id: true,
        team: { select: { id: true, name: true } },
        roster: {
          select: {
            players: {
              select: {
                player: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    deletedAt: true,
                    parent: { select: { email: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const playerIds: string[] = submissions.flatMap((s: any) =>
      (s.roster?.players ?? [])
        .map((rp: any) => rp.player)
        .filter((p: any) => p && !p.deletedAt)
        .map((p: any) => p.id)
    )

    const signatures =
      playerIds.length > 0 && waivers.length > 0
        ? await (prisma as any).waiverSignature.findMany({
            where: {
              playerId: { in: playerIds },
              waiverId: { in: waivers.map((w: any) => w.id) },
              OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
            },
            select: {
              playerId: true,
              waiverId: true,
              waiverVersion: true,
              signerName: true,
              signedAt: true,
            },
          })
        : []

    const currentVersion = new Map<string, number>(
      waivers.map((w: any) => [w.id, w.version])
    )
    const signedMap = new Map<string, { signerName: string; signedAt: Date }>()
    for (const s of signatures) {
      if (s.waiverVersion === currentVersion.get(s.waiverId)) {
        signedMap.set(`${s.waiverId}:${s.playerId}`, {
          signerName: s.signerName,
          signedAt: s.signedAt,
        })
      }
    }

    let signedCount = 0
    let outstandingCount = 0
    const teams = submissions.map((s: any) => {
      const players = (s.roster?.players ?? [])
        .map((rp: any) => rp.player)
        .filter((p: any) => p && !p.deletedAt)
        .map((p: any) => {
          const perWaiver = waivers.map((w: any) => {
            const hit = signedMap.get(`${w.id}:${p.id}`)
            if (hit) signedCount++
            else outstandingCount++
            return {
              waiverId: w.id,
              signed: !!hit,
              signerName: hit?.signerName ?? null,
              signedAt: hit?.signedAt ?? null,
            }
          })
          return {
            playerId: p.id,
            name: `${p.firstName} ${p.lastName}`,
            parentEmail: p.parent?.email ?? null,
            waivers: perWaiver,
            complete: perWaiver.every((w: any) => w.signed),
          }
        })
      return {
        submissionId: s.id,
        teamId: s.team.id,
        teamName: s.team.name,
        players,
        complete: players.every((p: any) => p.complete),
      }
    })

    return NextResponse.json({
      season: { id: season.id, label: season.label, leagueName: season.league.name },
      waivers,
      teams,
      totals: { signed: signedCount, outstanding: outstandingCount },
    })
  } catch (error) {
    console.error("Waiver status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const resendSchema = z.object({
  action: z.literal("resend"),
  submissionId: z.string().optional(),
})

/**
 * POST /api/seasons/[id]/waiver-status — re-send outstanding waiver emails,
 * for one approved team or the whole season. Live requests are skipped so
 * this never double-emails inside the 30-day link window.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { season, allowed } = await leagueSideAccess(
      sessionInfo.userId,
      sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = resendSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const submissions = await (prisma as any).teamSubmission.findMany({
      where: {
        seasonId: params.id,
        status: "APPROVED",
        ...(parsed.data.submissionId ? { id: parsed.data.submissionId } : {}),
      },
      select: { id: true },
    })
    if (parsed.data.submissionId && submissions.length === 0) {
      return NextResponse.json({ error: "Approved team not found" }, { status: 404 })
    }

    const totals = { sent: 0, alreadySigned: 0, alreadyRequested: 0, noParentEmail: 0 }
    for (const submission of submissions) {
      const result = await sendWaiversForApprovedSubmission(submission.id)
      totals.sent += result.sent
      totals.alreadySigned += result.alreadySigned
      totals.alreadyRequested += result.alreadyRequested
      totals.noParentEmail += result.noParentEmail
    }
    return NextResponse.json({ success: true, ...totals })
  } catch (error) {
    console.error("Waiver resend error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
