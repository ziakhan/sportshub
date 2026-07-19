/**
 * SMS seam (owner 2026-07-18): ONE Twilio integration shared by club-claim
 * verification and (future) phone-number login. Stays dark until the owner
 * supplies credentials — every caller must handle { ok: false, code:
 * "SMS_DISABLED" } gracefully and fall back to another channel.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * (talks to Twilio's REST API directly — no SDK dependency)
 */

export function smsEnabled(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  )
}

export async function sendSms(input: {
  to: string
  body: string
}): Promise<{ ok: true } | { ok: false; code: string; error?: string }> {
  if (!smsEnabled()) return { ok: false, code: "SMS_DISABLED" }
  const sid = process.env.TWILIO_ACCOUNT_SID!
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: input.to,
        From: process.env.TWILIO_FROM_NUMBER!,
        Body: input.body,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("Twilio send failed:", res.status, detail.slice(0, 300))
      return { ok: false, code: "SMS_SEND_FAILED" }
    }
    return { ok: true }
  } catch (err) {
    console.error("Twilio send error:", err)
    return { ok: false, code: "SMS_SEND_FAILED" }
  }
}

/** "+14165551234" → "+1•••••••1234" — enough to recognize, not to harvest. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "")
  if (digits.length < 6) return "•••"
  return `${digits.slice(0, 2)}${"•".repeat(Math.max(3, digits.length - 6))}${digits.slice(-4)}`
}

/** "info@northpole.ca" → "in•••@northpole.ca" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "•••"
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}•••@${domain}`
}
