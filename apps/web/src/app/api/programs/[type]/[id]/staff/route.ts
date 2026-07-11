import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notify } from "@/lib/notifications"
import {
  PROGRAM_TYPE_BY_SLUG,
  isAssignedProgramStaff,
  isClubAdmin,
  listProgramStaff,
  resolveProgram,
} from "@/lib/programs/staff"

export const dynamic = "force-dynamic"

/**
 * /api/programs/[type]/[id]/staff — the people running a camp/house league
 * (type slug: "camp" | "house-league"). Club admins assign/remove; the
 * assigned staff (and admins) can read the list. Assignment grants
 * manage-lite on the program (docs/roadmap/program-staff-plan.md).
 */

async function authContext(typeSlug: string, programId: string) {
  const programType = PROGRAM_TYPE_BY_SLUG[typeSlug]
  if (!programType) return { error: "Unknown program type", status: 400 as const }
  const auth = await getSessionUserId()
  if (!auth) return { error: "Unauthorized", status: 401 as const }
  const program = await resolveProgram(programType, programId)
  if (!program) return { error: "Program not found", status: 404 as const }
  const admin = await isClubAdmin(auth.userId, !!auth.isPlatformAdmin, program.tenantId)
  return { auth, program, programType, admin }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const ctx = await authContext(params.type, params.id)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    if (!ctx.admin && !(await isAssignedProgramStaff(ctx.auth.userId, ctx.programType, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({
      staff: await listProgramStaff(ctx.programType, params.id),
      canManage: ctx.admin,
    })
  } catch (error) {
    console.error("Program staff list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const assignSchema = z.object({
  userId: z.string().min(1),
  designation: z.enum(["LEAD", "ASSISTANT"]).default("ASSISTANT"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const ctx = await authContext(params.type, params.id)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    if (!ctx.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = assignSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid assignment" },
        { status: 400 }
      )
    }

    // Assignee must already be part of this club's staff pool
    const clubRole = await prisma.userRole.findFirst({
      where: {
        userId: parsed.data.userId,
        tenantId: ctx.program.tenantId,
        role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
      },
      select: { id: true },
    })
    if (!clubRole) {
      return NextResponse.json(
        { error: "That person isn't on this club's staff — invite them to the club first" },
        { status: 400 }
      )
    }

    const assignment = await (prisma as any).programStaff.upsert({
      where: {
        programType_programId_userId: {
          programType: ctx.programType,
          programId: params.id,
          userId: parsed.data.userId,
        },
      },
      create: {
        programType: ctx.programType,
        programId: params.id,
        userId: parsed.data.userId,
        designation: parsed.data.designation,
        assignedById: ctx.auth.userId,
      },
      update: { designation: parsed.data.designation },
      select: { userId: true, designation: true },
    })

    if (parsed.data.userId !== ctx.auth.userId) {
      await notify(prisma, {
        userId: parsed.data.userId,
        type: "program_assigned",
        title: `You're ${assignment.designation === "LEAD" ? "leading" : "helping run"} ${ctx.program.title}`,
        message: `You were added as ${assignment.designation === "LEAD" ? "the lead" : "an assistant"} on ${ctx.program.title}.`,
        link: `/clubs/${ctx.program.tenantId}/${params.type === "camp" ? "camps" : "house-leagues"}/${params.id}/signups`,
        referenceId: `${ctx.programType}:${params.id}`,
        referenceType: "ProgramStaff",
      })
    }

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error("Program staff assign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const removeSchema = z.object({ userId: z.string().min(1) })

export async function DELETE(
  request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const ctx = await authContext(params.type, params.id)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    if (!ctx.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = removeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    await (prisma as any).programStaff.deleteMany({
      where: { programType: ctx.programType, programId: params.id, userId: parsed.data.userId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Program staff remove error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
