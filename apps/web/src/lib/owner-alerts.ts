import { sendEmail, appBaseUrl, escapeHtml } from "@/lib/email"

/**
 * Real-time launch alerts to the owner's inbox (owner 2026-08-17: "email
 * notification to my email if anybody signs up in real time"). Fire and
 * forget on purpose: an alert must never slow down or fail the visitor's
 * request, and a lost alert still shows up on the launch dashboard.
 */

const OWNER_EMAIL = process.env.LAUNCH_ALERT_EMAIL || "khanzia@gmail.com"

function alertOwner(subject: string, bodyHtml: string) {
  sendEmail({
    to: OWNER_EMAIL,
    subject,
    html: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">${bodyHtml}
      <p style="color:#64748b;font-size:13px;margin-top:24px;">Full picture: <a href="${appBaseUrl()}/dashboard/admin/launch">the launch dashboard</a>.</p>
    </div>`,
  }).catch((e) => console.error("Owner alert failed:", e))
}

export function alertOwnerSignup(input: {
  contact: string
  kind: string
  identity: string | null
  source: string
  total: number
}) {
  alertOwner(
    `Launch signup: ${input.contact}`,
    `<h2 style="margin:0 0 12px;">New launch signup</h2>
     <p style="font-size:15px;line-height:1.6;margin:0;">
       <strong>${escapeHtml(input.contact)}</strong> (${input.kind})<br/>
       Identity: ${escapeHtml(input.identity || "not picked")}<br/>
       From: ${escapeHtml(input.source)}<br/>
       That makes ${input.total} on the list.
     </p>`
  )
}

export function alertOwnerClaim(input: {
  clubName: string
  method: string
  claimantEmail: string | null
}) {
  alertOwner(
    `Club claim started: ${input.clubName}`,
    `<h2 style="margin:0 0 12px;">Someone is claiming a club</h2>
     <p style="font-size:15px;line-height:1.6;margin:0;">
       Club: <strong>${escapeHtml(input.clubName)}</strong><br/>
       Verifying by: ${escapeHtml(input.method.toLowerCase())}<br/>
       Claimer email: ${escapeHtml(input.claimantEmail || "not given yet")}
     </p>`
  )
}
