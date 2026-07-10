import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * Team rollover — "Start next season" (docs/season-continuity-plan.md §2).
 *
 * GET  /api/teams/[id]/rollover — wizard bootstrap: the old team, its staff,
 *      its ACTIVE roster, and its weekly practice pattern.
 * POST /api/teams/[id]/rollover — one transaction: create the new team
 *      (lineage via continuedFromId), copy the SELECTED staff rows, optionally
 *      copy the practice-slot pattern, archive the old team.
 *
 * Carry-over offers are a separate, explicit click (rollover-offers) — the
 * owner decision is staged offers, reviewed first.
 */

const rolloverSchema = z.object({
  name: z.string().trim().min(3).max(100),
  ageGroup: z.string().trim().min(1),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().trim().max(100).optional(),
  // UserRole ids on the OLD team to carry over (seed ids aren't UUIDs — keep z.string())
  staffRoleIds: z.array(z.string()).max(50).default([]),
  copyPracticeSlots: z.boolean().optional().default(false),
})

/** ClubOwner/ClubManager of the team's tenant, or PlatformAdmin. */
async function loadAuthorizedTeam(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      ageGroup: true,
      gender: true,
      season: true,
      archivedAt: true,
    },
  })
  if (!team) return { team: null, allowed: false }

  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
    select: { id: true },
  })
  return { team, allowed: !!role }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { team, allowed } = await loadAuthorizedTeam(params.id, auth.userId)
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const [staff, roster, practiceSlots] = await Promise.all([
      prisma.userRole.findMany({
        where: { teamId: team.id, role: { in: ["Staff", "TeamManager"] } },
        select: {
          id: true,
          role: true,
          designation: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.teamPlayer.findMany({
        where: { teamId: team.id, status: "ACTIVE", player: { deletedAt: null } },
        select: {
          playerId: true,
          jerseyNumber: true,
          player: { select: { firstName: true, lastName: true } },
        },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.practiceSlot.findMany({
        where: { teamId: team.id },
        select: { dayOfWeek: true, startTime: true, durationMinutes: true, location: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
    ])

    return NextResponse.json({
      team: {
        id: team.id,
        tenantId: team.tenantId,
        name: team.name,
        ageGroup: team.ageGroup,
        gender: team.gender,
        season: team.season,
        archived: !!team.archivedAt,
      },
      staff: staff.map((s: any) => ({
        id: s.id,
        role: s.role,
        designation: s.designation,
        name:
          [s.user?.firstName, s.user?.lastName].filter(Boolean).join(" ") ||
          s.user?.email ||
          "Staff member",
      })),
      roster: roster.map((tp: any) => ({
        playerId: tp.playerId,
        jerseyNumber: tp.jerseyNumber,
        name: [tp.player.firstName, tp.player.lastName].filter(Boolean).join(" "),
      })),
      practiceSlots,
    })
  } catch (error) {
    console.error("Rollover bootstrap error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { team, allowed } = await loadAuthorizedTeam(params.id, auth.userId)
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (team.archivedAt) {
      return NextResponse.json(
        { error: "This team is already archived — it has already been rolled over." },
        { status: 409 }
      )
    }

    const parsed = rolloverSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid request", details: parsed.error.errors },
        { status: 400 }
      )
    }
    const data = parsed.data

    // Selected staff must be rows on THIS team
    const staffRoleIds = [...new Set(data.staffRoleIds)]
    const staffRows =
      staffRoleIds.length > 0
        ? await prisma.userRole.findMany({
            where: {
              id: { in: staffRoleIds },
              teamId: team.id,
              role: { in: ["Staff", "TeamManager"] },
            },
            select: { id: true, userId: true, role: true, designation: true },
          })
        : []
    if (staffRows.length !== staffRoleIds.length) {
      return NextResponse.json(
        { error: "One or more selected staff members don't belong to this team" },
        { status: 400 }
      )
    }
    const headCoaches = staffRows.filter((s: any) => s.designation === "HeadCoach")
    if (headCoaches.length > 1) {
      return NextResponse.json({ error: "A team can have at most one Head Coach" }, { status: 400 })
    }

    const newTeam = await prisma.$transaction(async (tx: any) => {
      // 1. The new season's team, linked back to this one
      const created = await tx.team.create({
        data: {
          tenantId: team.tenantId,
          name: data.name,
          ageGroup: data.ageGroup,
          gender: data.gender ?? null,
          season: data.season || null,
          continuedFromId: team.id,
        },
      })

      // 2. Carry over the selected staff (same role + designation, new team scope)
      for (const row of staffRows) {
        await tx.userRole.create({
          data: {
            userId: row.userId,
            role: row.role,
            tenantId: team.tenantId,
            teamId: created.id,
            designation: row.designation,
          },
        })
      }

      // 3. Optionally copy the weekly practice pattern (pattern only — no
      //    Practice instances, no announcement; staff re-announce next season)
      if (data.copyPracticeSlots) {
        const slots = await tx.practiceSlot.findMany({
          where: { teamId: team.id },
          select: { dayOfWeek: true, startTime: true, durationMinutes: true, location: true },
        })
        if (slots.length > 0) {
          await tx.practiceSlot.createMany({
            data: slots.map((s: any) => ({
              teamId: created.id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              durationMinutes: s.durationMinutes,
              location: s.location,
            })),
          })
        }
      }

      // 4. Archive the old team — hidden from active lists, history intact
      await tx.team.update({ where: { id: team.id }, data: { archivedAt: new Date() } })

      return created
    })

    return NextResponse.json({ newTeamId: newTeam.id }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A team with this name, age group and season already exists in your club" },
        { status: 409 }
      )
    }
    console.error("Team rollover error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
