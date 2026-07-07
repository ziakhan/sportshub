import nodemailer from "nodemailer"

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

const FROM = process.env.SMTP_FROM || "noreply@youthbasketballhub.com"

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  return transporter.sendMail({
    from: FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""),
  })
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
      <p><strong>${inviterName}</strong> has invited you to join <strong>${clubName}</strong> as <strong>${role}</strong>.</p>
      ${message ? `<p style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${message}"</p>` : ""}
      <p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Invitation
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If you don't have an account yet, you'll be prompted to create one first.</p>
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
      <p><strong>${inviterName}</strong> from <strong>${clubName}</strong> is inviting ${playerName ? `<strong>${playerName}</strong>` : "a player in your family"} to join <strong>${teamName}</strong>.</p>
      ${message ? `<p style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${message}"</p>` : ""}
      <p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Invitation
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If you don't have an account yet, sign up with this email address and the invitation will be waiting for you. Once you accept, you'll receive a team offer to review.</p>
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
}) {
  const subject = `Team Offer for ${playerName} from ${clubName}`
  const feeBlock =
    packages && packages.length > 1
      ? `<p><strong>Choose your package when you respond:</strong></p><ul>${packages
          .map((p) => `<li>${p.label} — $${p.fee.toFixed(2)}</li>`)
          .join("")}</ul>`
      : seasonFee > 0
        ? `<p><strong>Season Fee:</strong> $${seasonFee.toFixed(2)}</p>`
        : ""
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Team Offer</h2>
      <p>Hi ${parentName},</p>
      <p><strong>${clubName}</strong> would like to offer <strong>${playerName}</strong> a spot on <strong>${teamName}</strong>!</p>
      ${feeBlock}
      ${message ? `<p style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${message}"</p>` : ""}
      <p>To accept or decline this offer, please log in and visit your offers page.</p>
      <p>
        <a href="${offerLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Offer
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">When accepting, you'll need to provide uniform size and preferred jersey numbers.</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}
