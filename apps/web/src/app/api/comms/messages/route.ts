// POST /api/comms/messages — send a re-engagement (marketing) email to a
// computed audience. GET — the org's recent send log.
//
// Compliance invariants (docs/season-continuity-plan.md §4–5):
// - Consent is checked PER RECIPIENT at send time via hasMarketingConsent —
//   the audience list is never trusted as the gate. Non-consenting recipients
//   are counted as suppressed and skipped.
// - Every email carries marketingFooter(), minted PER RECIPIENT (the
//   unsubscribe token is per-user).
// - Every send is logged to MessageLog (recipientCount = actually delivered,
//   suppressedCount = consent-skipped).
// - Rate limit: max 5 sends per org per day (429 beyond that).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canSendOrgComms, resolveAudience } from "@/lib/comms/audiences"
import { hasMarketingConsent, type ConsentScope } from "@/lib/comms/consent"
import { sendEmail, escapeHtml, marketingFooter } from "@/lib/email"

export const dynamic = "force-dynamic"

const DAILY_SEND_LIMIT = 5
const SEND_BATCH_SIZE = 20

const sendSchema = z.object({
  scope: z.enum(["TENANT", "LEAGUE", "PLATFORM"]),
  orgId: z.string().optional().nullable(),
  audience: z.string().min(1),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  body: z.string().trim().min(1, "Message body is required").max(5000),
})

function orgLogWhere(scope: ConsentScope, orgId: string | null) {
  return {
    scope,
    tenantId: scope === "TENANT" ? orgId : null,
    leagueId: scope === "LEAGUE" ? orgId : null,
  }
}

/** tenant.name / league.name / "SportsHub" — null when the org is missing. */
async function getOrgName(scope: ConsentScope, orgId: string | null): Promise<string | null> {
  if (scope === "PLATFORM") return "SportsHub"
  if (!orgId) return null
  if (scope === "TENANT") {
    const tenant = await prisma.tenant.findUnique({ where: { id: orgId }, select: { name: true } })
    return tenant?.name ?? null
  }
  const league = await prisma.league.findUnique({ where: { id: orgId }, select: { name: true } })
  return league?.name ?? null
}

/** Plain text → email HTML: escape first, then \n\n → paragraphs, \n → <br/>. */
function bodyToHtml(body: string): string {
  return escapeHtml(body)
    .split(/\n{2,}/)
    .map((para) => `<p style="margin: 0 0 16px; line-height: 1.6;">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("")
}

export async function POST(request: NextRequest) {
  const auth = await getSessionUserId()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid request" },
      { status: 400 }
    )
  }
  const { scope, audience, subject, body } = parsed.data
  const orgId = scope === "PLATFORM" ? null : (parsed.data.orgId ?? null)
  if (scope !== "PLATFORM" && !orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const allowed = await canSendOrgComms(scope, orgId, auth.userId, auth.isPlatformAdmin)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const orgName = await getOrgName(scope, orgId)
  if (!orgName) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  // Rate limit — per org per calendar day.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const sentToday = await (prisma as any).messageLog.count({
    where: { ...orgLogWhere(scope, orgId), createdAt: { gte: startOfToday } },
  })
  if (sentToday >= DAILY_SEND_LIMIT) {
    return NextResponse.json(
      { error: `Daily limit reached (${DAILY_SEND_LIMIT} messages per day). Try again tomorrow.` },
      { status: 429 }
    )
  }

  const candidateIds = await resolveAudience(scope, orgId, audience)
  if (candidateIds === null) {
    return NextResponse.json({ error: "Unknown audience" }, { status: 400 })
  }

  // Send-time consent gate — per recipient, never the audience list.
  const consented: string[] = []
  let suppressed = 0
  for (const userId of candidateIds) {
    if (await hasMarketingConsent(userId, scope, orgId)) {
      consented.push(userId)
    } else {
      suppressed++
    }
  }

  // Soft-deleted accounts drop out here; count them as suppressed too.
  const recipients = await prisma.user.findMany({
    where: { id: { in: consented }, deletedAt: null },
    select: { id: true, email: true },
  })
  suppressed += consented.length - recipients.length

  const bodyHtml = bodyToHtml(body)
  const senderLine = `<p style="color: #666; font-size: 13px; margin: 0 0 16px;">From ${escapeHtml(orgName)} via SportsHub</p>`

  // Best-effort per recipient — a bounce never aborts the batch.
  let sent = 0
  for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
    const batch = recipients.slice(i, i + SEND_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((recipient: { id: string; email: string }) =>
        sendEmail({
          to: recipient.email,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              ${senderLine}
              <h2 style="margin: 0 0 16px;">${escapeHtml(subject)}</h2>
              ${bodyHtml}
              ${marketingFooter({ orgName, scope, orgId, userId: recipient.id })}
            </div>
          `,
        })
      )
    )
    sent += results.filter((r) => r.status === "fulfilled").length
  }

  const log = await (prisma as any).messageLog.create({
    data: {
      senderId: auth.userId,
      ...orgLogWhere(scope, orgId),
      audience,
      subject,
      body,
      recipientCount: sent,
      suppressedCount: suppressed,
    },
  })

  return NextResponse.json({ id: log.id, sent, suppressed, audienceSize: candidateIds.length })
}

export async function GET(request: NextRequest) {
  const auth = await getSessionUserId()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = request.nextUrl.searchParams.get("scope") as ConsentScope | null
  if (!scope || !["TENANT", "LEAGUE", "PLATFORM"].includes(scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
  }
  const orgId = scope === "PLATFORM" ? null : request.nextUrl.searchParams.get("orgId")
  if (scope !== "PLATFORM" && !orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const allowed = await canSendOrgComms(scope, orgId, auth.userId, auth.isPlatformAdmin)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const messages = await (prisma as any).messageLog.findMany({
    where: orgLogWhere(scope, orgId),
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      audience: true,
      subject: true,
      recipientCount: true,
      suppressedCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ messages })
}
