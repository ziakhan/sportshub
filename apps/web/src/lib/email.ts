import nodemailer from "nodemailer"
import { createUnsubscribeToken } from "@/lib/comms/unsubscribe"
import type { ConsentScope } from "@/lib/comms/consent"
import { siteUrl } from "@/lib/site"
import { senderEmail } from "@/lib/domains"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025"),
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
})

const FROM = process.env.SMTP_FROM || `SportsHubOne <${senderEmail("no-reply")}>`

/**
 * Canonical base URL for links inside emails. Two env vars were used
 * inconsistently across senders (NEXTAUTH_URL vs NEXT_PUBLIC_APP_URL) and some
 * paths fell back to "" (host-less dead links) or localhost in prod paths
 * (gap-audit 2026-07-09). Every email link goes through here now.
 */
export function appBaseUrl(): string {
  return siteUrl()
}

/** Escape user-supplied text before interpolating into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Currency-aware money for emails — replaces the hardcoded `$x.toFixed(2)`
 *  that showed $ regardless of the club's currency. */
export function formatMoney(amount: number, currency: string = "CAD"): string {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

/** Identification footer for TRANSACTIONAL email (receipts, invites, changes). */
export function transactionalFooter(orgName?: string): string {
  return `
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0 12px;" />
    <p style="color: #999; font-size: 12px;">
      Sent by ${orgName ? `${escapeHtml(orgName)} via ` : ""}SportsHub (Youth Basketball Hub).
      You received this because of an account, registration, or invitation associated with this address.
    </p>`
}

/**
 * CASL footer for MARKETING email: identifies the sending org and carries two
 * working opt-outs — this org, and the full preferences page. Every marketing
 * send MUST include this footer.
 */
export function marketingFooter({
  orgName,
  scope,
  orgId,
  userId,
}: {
  orgName: string
  scope: ConsentScope
  orgId: string | null
  userId: string
}): string {
  const base = appBaseUrl()
  const token = createUnsubscribeToken({ userId, scope, orgId })
  return `
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0 12px;" />
    <p style="color: #999; font-size: 12px;">
      Sent by ${escapeHtml(orgName)} via SportsHub (Youth Basketball Hub).
      <a href="${base}/api/comms/unsubscribe?token=${token}" style="color: #666;">Unsubscribe from ${escapeHtml(orgName)}</a>
      &nbsp;·&nbsp;
      <a href="${base}/settings/communications" style="color: #666;">Manage all email preferences</a>
    </p>`
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  /** Where a human's reply should land (e.g. support@); FROM stays the
   * DKIM-aligned transactional sender. */
  replyTo?: string
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailOptions) {
  // QA-403 (owner 2026-07-24): EVERY transactional send gets an EmailLog row
  // — "did the email go out?" must be a lookup, not a mystery. Logging is
  // best-effort and never fails or delays the send result.
  try {
    const result = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
      ...(replyTo ? { replyTo } : {}),
    })
    logEmail(to, subject, "SENT", null)
    return result
  } catch (error) {
    logEmail(to, subject, "FAILED", error instanceof Error ? error.message : String(error))
    throw error
  }
}

function logEmail(to: string, subject: string, status: "SENT" | "FAILED", error: string | null) {
  // Lazy import avoids a prisma dependency for edge-safe callers of siteUrl.
  import("@youthbasketballhub/db")
    .then(({ prisma }) =>
      (prisma as any).emailLog.create({ data: { to, subject, status, error } })
    )
    .catch((e) => console.error("EmailLog write failed:", e))
}

export async function sendMagicLinkEmail({
  to,
  firstName,
  link,
  code,
}: {
  to: string
  firstName?: string | null
  link: string
  code: string
}) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  const subject = `Your SportsHub sign-in code: ${code}`
  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 8px;">
      <div style="background: #18181b; border-radius: 20px; padding: 32px; color: #ffffff;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #fbbf24; font-weight: 700;">SportsHub</p>
        <h1 style="margin: 10px 0 0; font-size: 22px; color: #ffffff;">Sign in to SportsHub</h1>
        <p style="margin: 14px 0 0; font-size: 14px; line-height: 1.6; color: #d9d9df;">
          ${greeting} tap the button below to sign in — no password needed.
        </p>
        <p style="margin: 22px 0 0;">
          <a href="${link}" style="display: inline-block; padding: 13px 28px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Sign in to SportsHub
          </a>
        </p>
        <p style="margin: 24px 0 0; font-size: 13px; color: #9191a1;">
          On another device? Enter this code on the sign-in page:
        </p>
        <p style="margin: 8px 0 0; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: 'SF Mono', Menlo, Consolas, monospace;">${code}</p>
        <p style="margin: 24px 0 0; font-size: 12px; line-height: 1.6; color: #747486;">
          The link and code expire in 15 minutes and work once. If you didn't request this,
          you can safely ignore this email — nobody can sign in without it.
        </p>
      </div>
      ${transactionalFooter()}
    </div>
  `
  const text = `${greeting}\n\nSign in to SportsHub: ${link}\n\nOr enter this code on the sign-in page: ${code}\n\nThe link and code expire in 15 minutes and work once. If you didn't request this, ignore this email.`
  return sendEmail({ to, subject, html, text })
}

export async function sendStaffInviteEmail({
  to,
  clubName,
  role,
  inviterName,
  inviteLink,
  message,
}: {
  to: string
  clubName: string
  role: string
  inviterName: string
  inviteLink: string
  message?: string | null
}) {
  const subject = `You've been invited to join ${clubName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Staff Invitation</h2>
      <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(clubName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
      ${message ? `<p style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${escapeHtml(message)}"</p>` : ""}
      <p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Invitation
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If you don't have an account yet, you'll be prompted to create one first.</p>
      ${transactionalFooter(clubName)}
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendPlayerInviteEmail({
  to,
  clubName,
  teamName,
  playerName,
  inviterName,
  inviteLink,
  message,
}: {
  to: string
  clubName: string
  teamName: string
  playerName?: string | null
  inviterName: string
  inviteLink: string
  message?: string | null
}) {
  const subject = `${clubName} wants ${playerName || "a player in your family"} to join ${teamName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Player Invitation</h2>
      <p><strong>${escapeHtml(inviterName)}</strong> from <strong>${escapeHtml(clubName)}</strong> is inviting ${playerName ? `<strong>${escapeHtml(playerName)}</strong>` : "a player in your family"} to join <strong>${escapeHtml(teamName)}</strong>.</p>
      ${message ? `<p style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${escapeHtml(message)}"</p>` : ""}
      <p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Invitation
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If you don't have an account yet, sign up with this email address and the invitation will be waiting for you. Once you accept, you'll receive a team offer to review.</p>
      ${transactionalFooter(clubName)}
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendOfferEmail({
  to,
  parentName,
  playerName,
  clubName,
  teamName,
  seasonFee,
  packages,
  message,
  offerLink,
  currency = "CAD",
}: {
  to: string
  parentName: string
  playerName: string
  clubName: string
  teamName: string
  seasonFee: number
  /** Multi-option offers list their package choices instead of one fee */
  packages?: Array<{ label: string; fee: number }>
  message?: string
  offerLink: string
  /** Club currency (defaults CAD — the platform default). */
  currency?: string
}) {
  const subject = `Team Offer for ${playerName} from ${clubName}`
  const feeBlock =
    packages && packages.length > 1
      ? `<p><strong>Choose your package when you respond:</strong></p><ul>${packages
          .map((p) => `<li>${escapeHtml(p.label)} — ${formatMoney(p.fee, currency)}</li>`)
          .join("")}</ul>`
      : seasonFee > 0
        ? `<p><strong>Season Fee:</strong> ${formatMoney(seasonFee, currency)}</p>`
        : ""
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Team Offer</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p><strong>${escapeHtml(clubName)}</strong> would like to offer <strong>${escapeHtml(playerName)}</strong> a spot on <strong>${escapeHtml(teamName)}</strong>!</p>
      ${feeBlock}
      ${message ? `<p style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${escapeHtml(message)}"</p>` : ""}
      <p>To accept or decline this offer, please log in and visit your offers page.</p>
      <p>
        <a href="${offerLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Offer
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">When accepting, you'll need to provide uniform size and preferred jersey numbers.</p>
      ${transactionalFooter(clubName)}
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendWaiverSignEmail({
  to,
  parentName,
  playerName,
  orgName,
  waiverTitle,
  seasonLabel,
  teamName,
  link,
}: {
  to: string
  parentName?: string | null
  playerName: string
  orgName: string
  waiverTitle: string
  seasonLabel?: string | null
  teamName?: string | null
  link: string
}) {
  const greeting = parentName ? `Hi ${escapeHtml(parentName)},` : "Hi,"
  const context = [teamName, seasonLabel].filter(Boolean).map((v) => escapeHtml(v as string)).join(" · ")
  const subject = `Action needed: sign ${waiverTitle} for ${playerName}`
  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 8px;">
      <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 20px; padding: 32px;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #4f46e5; font-weight: 700;">${escapeHtml(orgName)}</p>
        <h1 style="margin: 10px 0 0; font-size: 21px; color: #18181b;">${escapeHtml(waiverTitle)}</h1>
        ${context ? `<p style="margin: 6px 0 0; font-size: 13px; color: #71717a;">${context}</p>` : ""}
        <p style="margin: 16px 0 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">
          ${greeting} before <strong>${escapeHtml(playerName)}</strong> can participate with ${escapeHtml(orgName)},
          a parent or guardian needs to review and sign this document. It takes about a minute.
        </p>
        <p style="margin: 22px 0 0;">
          <a href="${link}" style="display: inline-block; padding: 13px 28px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Review and sign
          </a>
        </p>
        <p style="margin: 24px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa;">
          This link is personal to ${escapeHtml(playerName)} and expires in 30 days.
          If someone else in your family already signed, the page will tell you and nothing more is needed.
        </p>
      </div>
      ${transactionalFooter(orgName)}
    </div>
  `
  const text = `${greeting}\n\nBefore ${playerName} can participate with ${orgName}, a parent or guardian needs to review and sign: ${waiverTitle}.\n\nReview and sign: ${link}\n\nThis link is personal to ${playerName} and expires in 30 days.`
  return sendEmail({ to, subject, html, text })
}

/**
 * Roster-deadline reminder to team staff (owner ruling 2026-08-11, QA T-017).
 * One template for the whole cadence: the window decides the subject line and
 * urgency, the body always carries the live player count and the one link
 * that fixes it. Every ask is about SUBMISSION (owner 2026-08-12: the
 * separate finalize action was removed; submitting is the only state the
 * league, the reminders and the draw care about).
 */
export async function sendRosterReminderEmail({
  to,
  staffName,
  teamName,
  leagueName,
  seasonLabel,
  deadlineText,
  playerCount,
  window,
  link,
}: {
  to: string
  staffName?: string | null
  teamName: string
  leagueName: string
  seasonLabel: string
  deadlineText: string
  playerCount: number
  window: "t30" | "t14" | "t7" | "t24h" | "overdue"
  link: string
}) {
  const greeting = staffName ? `Hi ${escapeHtml(staffName)},` : "Hi,"
  const subject =
    window === "overdue"
      ? `Overdue: ${teamName}'s roster for ${leagueName} was due ${deadlineText}`
      : window === "t24h"
        ? `Last day: ${teamName}'s roster for ${leagueName} is due ${deadlineText}`
        : `${teamName}'s roster for ${leagueName} is due ${deadlineText}`
  const countLine = `${teamName} has ${playerCount} player${playerCount === 1 ? "" : "s"} on its ${escapeHtml(seasonLabel)} roster (minimum 5, 8 or more recommended).`
  const askLine =
    window === "overdue"
      ? `The deadline has passed. Until the roster is submitted, the schedule is planned without ${escapeHtml(teamName)}.`
      : `Submit the roster before ${escapeHtml(deadlineText)} so the league can plan with your team.`
  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 8px;">
      <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 20px; padding: 32px;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #4f46e5; font-weight: 700;">${escapeHtml(leagueName)}</p>
        <h1 style="margin: 10px 0 0; font-size: 21px; color: #18181b;">${window === "overdue" ? "Roster overdue" : "Roster deadline"}: ${escapeHtml(deadlineText)}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #71717a;">${escapeHtml(teamName)} · ${escapeHtml(seasonLabel)}</p>
        <p style="margin: 16px 0 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">
          ${greeting} ${countLine}
        </p>
        <p style="margin: 10px 0 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">${askLine}</p>
        <p style="margin: 22px 0 0;">
          <a href="${link}" style="display: inline-block; padding: 13px 28px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Open the roster
          </a>
        </p>
      </div>
      ${transactionalFooter(leagueName)}
    </div>
  `
  const text = `${greeting}\n\n${teamName} has ${playerCount} player${playerCount === 1 ? "" : "s"} on its ${seasonLabel} roster (minimum 5, 8 or more recommended).\n${askLine.replace(/<[^>]*>/g, "")}\n\nOpen the roster: ${link}`
  return sendEmail({ to, subject, html, text })
}

/**
 * League-operator digest (owner ruling 2026-08-11, QA T-017): "N teams still
 * un-rostered", sent at T-7 and the day after the deadline so the operator
 * can chase humans, not statuses.
 */
export async function sendRosterDigestEmail({
  to,
  operatorName,
  leagueName,
  seasonLabel,
  deadlineText,
  overdue,
  teams,
  link,
}: {
  to: string
  operatorName?: string | null
  leagueName: string
  seasonLabel: string
  deadlineText: string
  overdue: boolean
  teams: Array<{ name: string; clubName?: string | null; playerCount: number }>
  link: string
}) {
  const greeting = operatorName ? `Hi ${escapeHtml(operatorName)},` : "Hi,"
  const subject = overdue
    ? `${teams.length} team${teams.length === 1 ? "" : "s"} missed the roster deadline for ${leagueName} ${seasonLabel}`
    : `${teams.length} team${teams.length === 1 ? "" : "s"} still un-rostered for ${leagueName} ${seasonLabel}`
  const rows = teams
    .map(
      (t) => `
        <tr>
          <td style="padding: 6px 10px; border-bottom: 1px solid #f4f4f5; font-size: 13px; color: #18181b;">${escapeHtml(t.name)}${t.clubName ? `<span style="color: #a1a1aa;"> · ${escapeHtml(t.clubName)}</span>` : ""}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #f4f4f5; font-size: 13px; color: #71717a; text-align: right;">${t.playerCount} player${t.playerCount === 1 ? "" : "s"}</td>
        </tr>`
    )
    .join("")
  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 8px;">
      <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 20px; padding: 32px;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #4f46e5; font-weight: 700;">${escapeHtml(leagueName)}</p>
        <h1 style="margin: 10px 0 0; font-size: 21px; color: #18181b;">${overdue ? "Rosters overdue" : "Rosters not final yet"}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #71717a;">${escapeHtml(seasonLabel)} · rosters ${overdue ? "were due" : "due"} ${escapeHtml(deadlineText)}</p>
        <p style="margin: 16px 0 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">
          ${greeting} these teams have not submitted their roster${overdue ? ", and the schedule will be planned without them until they do" : ""}:
        </p>
        <table style="margin: 14px 0 0; width: 100%; border-collapse: collapse;">${rows}</table>
        <p style="margin: 22px 0 0;">
          <a href="${link}" style="display: inline-block; padding: 13px 28px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Open the season
          </a>
        </p>
      </div>
      ${transactionalFooter(leagueName)}
    </div>
  `
  const text = `${greeting}\n\nThese teams have not submitted their ${seasonLabel} roster (${overdue ? "was due" : "due"} ${deadlineText}):\n${teams.map((t) => `- ${t.name}${t.clubName ? ` (${t.clubName})` : ""}: ${t.playerCount} player${t.playerCount === 1 ? "" : "s"}`).join("\n")}\n\nOpen the season: ${link}`
  return sendEmail({ to, subject, html, text })
}
