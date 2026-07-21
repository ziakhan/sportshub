import crypto from "crypto"
import { prisma } from "@youthbasketballhub/db"
import { sendEmail, appBaseUrl, escapeHtml } from "@/lib/email"
import { sendSms, smsEnabled, maskEmail, maskPhone } from "@/lib/sms"
import { notifyMany } from "@/lib/notifications"
import { audit } from "@/lib/audit"

/**
 * Club claiming v2 (owner 2026-07-18, SETTLED flow): claim-first,
 * account-at-end — but ownership is USER-bound, never contact-bound.
 *
 *   anonymous claim → code to the club's contact ON FILE (census data)
 *   → verify → completion token + ~14-day reservation
 *   → register/sign in with the token → claim binds to the User
 *   → club CLAIMED (ClubOwner role), claim-time corrections applied.
 *
 * No contact on file → paper-proof note + claimer email → admin reviews →
 * approval issues the same completion token to the claimer's email.
 */

const CODE_ATTEMPT_CAP = 5
const RESERVATION_DAYS = 14
const CODE_TTL_MINUTES = 30

export type ClaimChannel = "email" | "sms" | "proof"

export interface ClaimCorrections {
  name?: string
  website?: string
  contactEmail?: string
  phoneNumber?: string
  city?: string
  description?: string
}

/** A claim that blocks new attempts: awaiting admin, code out, or reserved. */
export async function liveClaimFor(tenantId: string) {
  return (prisma as any).clubClaim.findFirst({
    where: {
      tenantId,
      OR: [
        { status: "PENDING" },
        {
          status: "EMAIL_SENT",
          verificationSentAt: { gte: new Date(Date.now() - CODE_TTL_MINUTES * 60_000) },
        },
        { status: "VERIFIED_UNBOUND", completionExpiresAt: { gte: new Date() } },
      ],
    },
    select: { id: true, status: true, completionExpiresAt: true },
  })
}

export async function getClaimOptions(tenantId: string) {
  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      city: true,
      website: true,
      status: true,
      contactEmail: true,
      phoneNumber: true,
      description: true,
    },
  })
  if (!tenant) return null
  const live = tenant.status === "UNCLAIMED" ? await liveClaimFor(tenantId) : null
  return {
    tenantId: tenant.id,
    name: tenant.name,
    city: tenant.city,
    claimable: tenant.status === "UNCLAIMED" && !live,
    alreadyClaimed: tenant.status !== "UNCLAIMED",
    claimInProgress: !!live,
    channels: [
      ...(tenant.contactEmail
        ? [{ channel: "email" as const, hint: maskEmail(tenant.contactEmail) }]
        : []),
      ...(tenant.phoneNumber && smsEnabled()
        ? [{ channel: "sms" as const, hint: maskPhone(tenant.phoneNumber) }]
        : []),
      { channel: "proof" as const, hint: null },
    ],
    // prefill for the corrections step (what we believe today)
    current: {
      name: tenant.name,
      website: tenant.website,
      contactEmail: tenant.contactEmail ? maskEmail(tenant.contactEmail) : null,
      phoneNumber: tenant.phoneNumber ? maskPhone(tenant.phoneNumber) : null,
      city: tenant.city,
    },
  }
}

export async function startClaim(input: {
  tenantId: string
  channel: ClaimChannel
  claimantEmail?: string
  proofNote?: string
  proofDocumentUrl?: string
  corrections?: ClaimCorrections
  message?: string
}): Promise<
  | { ok: true; claimId: string; status: string; sentTo?: string }
  | { ok: false; error: string; code: string; status: number }
> {
  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, name: true, status: true, contactEmail: true, phoneNumber: true },
  })
  if (!tenant) return { ok: false, error: "Club not found", code: "NOT_FOUND", status: 404 }
  if (tenant.status !== "UNCLAIMED") {
    return { ok: false, error: "This club has already been claimed", code: "CLAIMED", status: 409 }
  }
  const live = await liveClaimFor(input.tenantId)
  if (live) {
    return {
      ok: false,
      error: "A claim on this club is already in progress",
      code: "IN_PROGRESS",
      status: 409,
    }
  }

  if (input.channel === "proof") {
    if (!input.claimantEmail || !input.proofNote) {
      return {
        ok: false,
        error: "Your email and a note describing your proof are required",
        code: "BAD_INPUT",
        status: 400,
      }
    }
    const claim = await (prisma as any).clubClaim.create({
      data: {
        tenantId: tenant.id,
        method: "PROOF",
        status: "PENDING",
        claimantEmail: input.claimantEmail,
        proofNote: input.proofNote,
        proofDocumentUrl: input.proofDocumentUrl ?? null,
        corrections: input.corrections ?? undefined,
        message: input.message ?? null,
      },
    })
    const admins = await prisma.userRole.findMany({
      where: { role: "PlatformAdmin" },
      select: { userId: true },
      distinct: ["userId"],
    })
    await notifyMany(
      prisma,
      admins.map((a) => a.userId),
      {
        type: "club_claim",
        title: "Club Claim — Proof Review Needed",
        message: `"${tenant.name}" has no contact on file; a claimer submitted proof for review.`,
        link: "/dashboard/admin/claims",
        referenceId: claim.id,
        referenceType: "ClubClaim",
      }
    )
    return { ok: true, claimId: claim.id, status: "PENDING" }
  }

  // Code channels — the code goes to the contact ON FILE, never the claimer
  const contactPoint = input.channel === "email" ? tenant.contactEmail : tenant.phoneNumber
  if (!contactPoint) {
    return {
      ok: false,
      error: `This club has no ${input.channel === "email" ? "email" : "phone number"} on file`,
      code: "NO_CONTACT",
      status: 409,
    }
  }
  if (input.channel === "sms" && !smsEnabled()) {
    return {
      ok: false,
      error: "SMS verification is not available yet — use email or proof",
      code: "SMS_DISABLED",
      status: 503,
    }
  }

  const code = crypto.randomInt(100000, 1000000).toString()
  const claim = await (prisma as any).clubClaim.create({
    data: {
      tenantId: tenant.id,
      method: input.channel.toUpperCase(),
      status: "EMAIL_SENT",
      verificationCode: code,
      verificationSentAt: new Date(),
      contactPoint,
      claimantEmail: input.claimantEmail ?? null,
      corrections: input.corrections ?? undefined,
      message: input.message ?? null,
    },
  })

  if (input.channel === "email") {
    await sendEmail({
      to: contactPoint,
      subject: `Verification code for claiming ${tenant.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Club ownership verification</h2>
          <p>Someone is claiming <strong>${escapeHtml(tenant.name)}</strong> on SportsHub using this contact address.</p>
          <p>If that's you (or someone at your club), enter this code to continue:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 24px; border-radius: 8px;">${code}</span>
          </div>
          <p>The code expires in ${CODE_TTL_MINUTES} minutes. If you did not expect this, ignore this email — nothing happens without the code.</p>
        </div>
      `,
      text: `SportsHub claim code for ${tenant.name}: ${code} (expires in ${CODE_TTL_MINUTES} minutes)`,
    })
  } else {
    const sent = await sendSms({
      to: contactPoint,
      body: `SportsHub: ${code} is your verification code for claiming ${tenant.name}. Expires in ${CODE_TTL_MINUTES} min.`,
    })
    if (!sent.ok) {
      await (prisma as any).clubClaim.delete({ where: { id: claim.id } })
      return { ok: false, error: "Could not send the SMS — try email", code: sent.code, status: 502 }
    }
  }

  return {
    ok: true,
    claimId: claim.id,
    status: "EMAIL_SENT",
    sentTo: input.channel === "email" ? maskEmail(contactPoint) : maskPhone(contactPoint),
  }
}

export async function verifyClaimCode(input: {
  claimId: string
  code: string
}): Promise<
  | { ok: true; completionToken: string; expiresAt: string }
  | { ok: false; error: string; code: string; status: number }
> {
  const claim = await (prisma as any).clubClaim.findUnique({
    where: { id: input.claimId },
    select: {
      id: true,
      status: true,
      verificationCode: true,
      verificationSentAt: true,
      attempts: true,
      contactPoint: true,
      method: true,
      tenant: { select: { id: true, name: true } },
    },
  })
  if (!claim) return { ok: false, error: "Claim not found", code: "NOT_FOUND", status: 404 }
  if (claim.status !== "EMAIL_SENT") {
    return { ok: false, error: "This claim is not awaiting a code", code: "BAD_STATE", status: 409 }
  }
  if (
    !claim.verificationSentAt ||
    Date.now() - new Date(claim.verificationSentAt).getTime() > CODE_TTL_MINUTES * 60_000
  ) {
    await (prisma as any).clubClaim.update({
      where: { id: claim.id },
      data: { status: "EXPIRED" },
    })
    return { ok: false, error: "The code has expired — start again", code: "EXPIRED", status: 410 }
  }
  if (claim.attempts >= CODE_ATTEMPT_CAP) {
    await (prisma as any).clubClaim.update({
      where: { id: claim.id },
      data: { status: "EXPIRED" },
    })
    return { ok: false, error: "Too many attempts — start again", code: "TOO_MANY", status: 429 }
  }
  if (claim.verificationCode !== input.code) {
    await (prisma as any).clubClaim.update({
      where: { id: claim.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, error: "That code is not right", code: "BAD_CODE", status: 400 }
  }

  const { token, expiresAt } = await issueCompletionToken(claim.id)

  // The settled flow: tell THAT contact point the claim verified and how to
  // take ownership. The verifier already proved inbox/phone control by
  // entering the code, so the link also returns in the API response.
  const link = `${appBaseUrl()}/claim/complete?token=${token}`
  if (claim.method === "EMAIL" && claim.contactPoint) {
    sendEmail({
      to: claim.contactPoint,
      subject: `${claim.tenant.name} verified — register to take ownership`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You're verified for ${escapeHtml(claim.tenant.name)}</h2>
          <p>Create an account (any email you like) or sign in, and the club binds to YOUR account — ownership lives with the person, not this inbox.</p>
          <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Take ownership of ${escapeHtml(claim.tenant.name)}</a></p>
          <p>This link reserves the club for ${RESERVATION_DAYS} days.</p>
        </div>
      `,
      text: `You're verified for ${claim.tenant.name}. Take ownership (reserved ${RESERVATION_DAYS} days): ${link}`,
    }).catch(() => {})
  } else if (claim.method === "SMS" && claim.contactPoint) {
    sendSms({
      to: claim.contactPoint,
      body: `SportsHub: ${claim.tenant.name} verified. Take ownership (reserved ${RESERVATION_DAYS} days): ${link}`,
    }).catch(() => {})
  }

  return { ok: true, completionToken: token, expiresAt: expiresAt.toISOString() }
}

/** Flip a claim to VERIFIED_UNBOUND with a fresh completion token + 14-day
 * reservation. Also used by admin approval of paper-proof claims. */
export async function issueCompletionToken(claimId: string) {
  const token = crypto.randomBytes(24).toString("base64url")
  const expiresAt = new Date(Date.now() + RESERVATION_DAYS * 24 * 3600_000)
  await (prisma as any).clubClaim.update({
    where: { id: claimId },
    data: {
      status: "VERIFIED_UNBOUND",
      verifiedAt: new Date(),
      completionToken: token,
      completionExpiresAt: expiresAt,
    },
  })
  return { token, expiresAt }
}

export async function completeClaim(input: {
  token: string
  userId: string
}): Promise<
  | { ok: true; tenantId: string; tenantName: string }
  | { ok: false; error: string; code: string; status: number }
> {
  const claim = await (prisma as any).clubClaim.findUnique({
    where: { completionToken: input.token },
    select: {
      id: true,
      status: true,
      completionExpiresAt: true,
      corrections: true,
      tenant: { select: { id: true, name: true, status: true } },
    },
  })
  if (!claim) return { ok: false, error: "Invalid link", code: "NOT_FOUND", status: 404 }
  if (claim.status !== "VERIFIED_UNBOUND") {
    return { ok: false, error: "This claim was already completed", code: "BAD_STATE", status: 409 }
  }
  if (!claim.completionExpiresAt || new Date(claim.completionExpiresAt) < new Date()) {
    await (prisma as any).clubClaim.update({
      where: { id: claim.id },
      data: { status: "EXPIRED" },
    })
    return {
      ok: false,
      error: "The reservation expired — start the claim again",
      code: "EXPIRED",
      status: 410,
    }
  }
  if (claim.tenant.status !== "UNCLAIMED") {
    return { ok: false, error: "This club has already been claimed", code: "CLAIMED", status: 409 }
  }

  const corrections = (claim.corrections ?? {}) as ClaimCorrections
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.clubClaim.update({
      where: { id: claim.id },
      data: {
        status: "APPROVED",
        userId: input.userId,
        reviewedAt: new Date(),
        reviewNote: "Completed via verified claim token",
      },
    })
    // Claim-time corrections apply in one shot; the new owner has full edit
    // rights from here anyway.
    const tenantData: Record<string, any> = { status: "ACTIVE" }
    if (corrections.name) tenantData.name = corrections.name
    if (corrections.website !== undefined) tenantData.website = corrections.website
    if (corrections.contactEmail !== undefined) tenantData.contactEmail = corrections.contactEmail
    if (corrections.phoneNumber !== undefined) tenantData.phoneNumber = corrections.phoneNumber
    if (corrections.city !== undefined) tenantData.city = corrections.city
    if (corrections.description !== undefined) tenantData.description = corrections.description
    await tx.tenant.update({ where: { id: claim.tenant.id }, data: tenantData })

    const existingRole = await tx.userRole.findFirst({
      where: { userId: input.userId, role: "ClubOwner", tenantId: claim.tenant.id },
    })
    if (!existingRole) {
      await tx.userRole.create({
        data: { userId: input.userId, role: "ClubOwner", tenantId: claim.tenant.id },
      })
    }
    await audit(tx, {
      actorId: input.userId,
      actorRole: "ClubOwner",
      action: "CLAIM_COMPLETE",
      resource: "ClubClaim",
      resourceId: claim.id,
      tenantId: claim.tenant.id,
      changes: {
        status: "APPROVED",
        boundTo: input.userId,
        corrections: Object.keys(corrections),
      },
    })
  })

  return { ok: true, tenantId: claim.tenant.id, tenantName: claim.tenant.name }
}
