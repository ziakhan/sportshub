import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

const postSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(5000),
})

/**
 * POST /api/seasons/[id]/announce — season-scoped club blast (owner
 * 2026-07-29): message every club operator with a team in the season, bell +
 * email. The league's words go verbatim; sender context is added around them.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { id: true, label: true, leagueId: true, league: { select: { name: true, ownerId: true } } },
    })
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    const allowed =
      auth.isPlatformAdmin ||
      season.league.ownerId === auth.userId ||
      !!(await prisma.userRole.findFirst({
        where: { userId: auth.userId, leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
        select: { id: true },
      }))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = postSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    const submissions = await (prisma as any).teamSubmission.findMany({
      where: { seasonId: params.id, status: { in: ["PENDING", "APPROVED"] } },
      select: { team: { select: { tenantId: true } } },
    })
    const tenantIds = [...new Set(submissions.map((s: any) => s.team.tenantId))] as string[]
    if (tenantIds.length === 0) {
      return NextResponse.json({ error: "No clubs in this season yet" }, { status: 400 })
    }
    const operators = await prisma.userRole.findMany({
      where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true, user: { select: { email: true, firstName: true } } },
    })
    const recipients = [...new Map(operators.map((o: any) => [o.userId, o])).values()] as any[]

    await notifyMany(
      prisma,
      recipients.map((r) => r.userId),
      {
        type: "league_announcement",
        title: `${season.league.name}: ${parsed.data.subject}`,
        message: parsed.data.body.slice(0, 500),
        link: `/manage`,
        referenceId: season.id,
        referenceType: "Season",
      }
    )

    let emailed = 0
    for (const r of recipients) {
      if (!r.user?.email) continue
      try {
        const bodyHtml = parsed.data.body
          .split("\n")
          .map((l) => `<p style="margin:0 0 10px">${l.replace(/</g, "&lt;")}</p>`)
          .join("")
        await sendEmail({
          to: r.user.email,
          subject: `[${season.league.name} · ${season.label}] ${parsed.data.subject}`,
          html: `${bodyHtml}<p style="color:#6b7280;font-size:12px;margin-top:18px">Sent by ${season.league.name} to all clubs in ${season.label} via SportsHub One.</p>`,
          text: `${parsed.data.body}\n\nSent by ${season.league.name} to all clubs in ${season.label} via SportsHub One.`,
        })
        emailed++
      } catch (e) {
        console.error("Announce email failed:", r.user.email, e)
      }
    }

    return NextResponse.json({ success: true, clubs: tenantIds.length, recipients: recipients.length, emailed })
  } catch (error) {
    console.error("Season announce error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
