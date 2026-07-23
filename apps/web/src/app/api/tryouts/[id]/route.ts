import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany } from "@/lib/notifications"
import { isClubAdmin, canActOnTeam } from "@/lib/authz/team-scope"
import { intraOrgConflictMessage } from "@/lib/venues/conflicts"

export const dynamic = "force-dynamic"

const updateTryoutSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().nullable().optional(),
  ageGroup: z.string().optional(),
  agePolicy: z.enum(["STRICT", "PREFERRED", "OPEN"]).optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  location: z.string().min(3).optional(),
  venueId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().optional(),
  duration: z.number().nullable().optional(),
  fee: z.number().min(0).optional(),
  maxParticipants: z.number().nullable().optional(),
  isPublic: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
})

/**
 * Get tryout detail
 * GET /api/tryouts/[id]
 * Public for published tryouts; includes user's signup if authenticated
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      include: {
        tenant: {
          include: {
            branding: true,
          },
        },
        team: {
          select: { id: true, name: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            signups: {
              where: { status: { not: "CANCELLED" } },
            },
          },
        },
      },
    })

    if (!tryout) {
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    // Draft (unpublished) tryouts are visible only to those who may manage
    // them (security fix 2026-07-20 — was ANY tenant role, incl. a Player):
    // club admins, or staff of the tryout's own team.
    const session = await getServerSession(authOptions)
    if (!tryout.isPublished) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
      }
      const canSee =
        (await isClubAdmin(session.user.id, tryout.tenantId)) ||
        (tryout.teamId
          ? await canActOnTeam(session.user.id, tryout.tenantId, tryout.teamId)
          : false)
      if (!canSee) {
        return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
      }
    }

    // Check if authenticated user has existing signups
    let userSignups: Array<{
      id: string
      playerName: string
      status: string
    }> = []

    if (session?.user?.id) {
      const userId = session.user.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })

      if (user) {
        userSignups = await prisma.tryoutSignup.findMany({
          where: {
            tryoutId: params.id,
            userId: user.id,
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            playerName: true,
            status: true,
          },
        })
      }
    }

    return NextResponse.json({
      ...tryout,
      signupCount: tryout._count.signups,
      userSignups,
    })
  } catch (error) {
    console.error("Get tryout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Update tryout
 * PATCH /api/tryouts/[id]
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        tenantId: true,
        teamId: true,
        title: true,
        isPublished: true,
        venueId: true,
        scheduledAt: true,
        duration: true,
      },
    })

    if (!tryout) {
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    // Security fix 2026-07-20: admins edit any tryout; a coach edits their OWN
    // team's tryout (club-wide, team-less tryouts stay admin-only).
    const admin = await isClubAdmin(session.user.id, tryout.tenantId)
    const allowed = admin
      ? true
      : tryout.teamId
        ? await canActOnTeam(session.user.id, tryout.tenantId, tryout.teamId)
        : false
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateTryoutSchema.parse(body)

    // A coach may not reassign the tryout to a team they don't coach.
    if (
      !admin &&
      validatedData.teamId !== undefined &&
      validatedData.teamId !== tryout.teamId &&
      !(validatedData.teamId && (await canActOnTeam(session.user.id, tryout.tenantId, validatedData.teamId)))
    ) {
      return NextResponse.json(
        { error: "You can only assign a tryout to your own team" },
        { status: 403 }
      )
    }

    const data: Record<string, unknown> = {}
    if (validatedData.title !== undefined) data.title = validatedData.title
    if (validatedData.description !== undefined) data.description = validatedData.description
    if (validatedData.ageGroup !== undefined) data.ageGroup = validatedData.ageGroup
    if (validatedData.agePolicy !== undefined) data.agePolicy = validatedData.agePolicy
    if (validatedData.gender !== undefined) data.gender = validatedData.gender
    if (validatedData.location !== undefined) data.location = validatedData.location
    if (validatedData.venueId !== undefined) data.venueId = validatedData.venueId || null
    if (validatedData.scheduledAt !== undefined)
      data.scheduledAt = new Date(validatedData.scheduledAt)
    if (validatedData.duration !== undefined) data.duration = validatedData.duration
    if (validatedData.fee !== undefined) data.fee = validatedData.fee
    if (validatedData.maxParticipants !== undefined)
      data.maxParticipants = validatedData.maxParticipants
    if (validatedData.isPublic !== undefined) data.isPublic = validatedData.isPublic
    if (validatedData.isPublished !== undefined) data.isPublished = validatedData.isPublished
    if (validatedData.teamId !== undefined) data.teamId = validatedData.teamId

    // Intra-org HARD block: re-check whenever the venue or time is changing.
    const touchesBooking =
      validatedData.venueId !== undefined ||
      validatedData.scheduledAt !== undefined ||
      validatedData.duration !== undefined
    const effectiveVenueId =
      validatedData.venueId !== undefined ? validatedData.venueId || null : tryout.venueId
    if (touchesBooking && effectiveVenueId) {
      const conflict = await intraOrgConflictMessage({
        venueId: effectiveVenueId,
        startAt:
          validatedData.scheduledAt !== undefined
            ? new Date(validatedData.scheduledAt)
            : tryout.scheduledAt,
        durationMinutes:
          (validatedData.duration !== undefined ? validatedData.duration : tryout.duration) ?? 90,
        tenantId: tryout.tenantId,
        excludeTryoutId: params.id,
      })
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
    }

    // G7: unpublishing a tryout that families already signed up for used to
    // be silent — tell every non-cancelled signup's parent.
    const unpublishing = tryout.isPublished && validatedData.isPublished === false

    await prisma.$transaction(async (tx: any) => {
      await tx.tryout.update({
        where: { id: params.id },
        data,
      })

      if (unpublishing) {
        const signups = await tx.tryoutSignup.findMany({
          where: { tryoutId: params.id, status: { not: "CANCELLED" } },
          select: { userId: true },
        })
        const parentIds: string[] = Array.from(new Set(signups.map((s: any) => s.userId)))
        await notifyMany(tx, parentIds, {
          type: "tryout_unpublished",
          title: "Tryout No Longer Available",
          message: `"${tryout.title}" has been unpublished by the club. Your signup is on hold — the club will follow up if it is rescheduled.`,
          link: `/tryouts/${tryout.id}`,
          referenceId: tryout.id,
          referenceType: "Tryout",
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update tryout error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Validation error: " +
            error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          details: error.errors,
        },
        { status: 400 }
      )
    }

    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
