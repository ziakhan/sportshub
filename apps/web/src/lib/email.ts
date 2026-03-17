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
