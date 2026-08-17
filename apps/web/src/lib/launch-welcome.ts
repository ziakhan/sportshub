import crypto from "crypto"
import { sendEmail, escapeHtml } from "@/lib/email"
import { sendSms, smsEnabled } from "@/lib/sms"
import { PRIMARY_DOMAIN, brandEmail } from "@/lib/domains"

/**
 * The launch-list welcome (owner 2026-08-17): the first and only thing a
 * signup hears from us before launch day. Email signups get the branded
 * confirmation below; phone signups get one SMS the moment Twilio
 * credentials exist (sendSms stays dark until then and this skips quietly).
 *
 * Fire and forget from the notify route: a welcome that fails must never
 * fail the signup.
 */

const BRAND_URL = `https://${PRIMARY_DOMAIN}`

/** Opt-out link token: HMAC over the contact, no table needed. */
export function launchUnsubToken(contact: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "dev-secret"
  return crypto.createHmac("sha256", secret).update(`launch:${contact}`).digest("hex").slice(0, 32)
}

export function launchUnsubUrl(contact: string): string {
  const c = Buffer.from(contact).toString("base64url")
  return `${BRAND_URL}/api/launch/unsubscribe?c=${c}&t=${launchUnsubToken(contact)}`
}

/* Email-client-safe brand pieces: tables and inline styles only, colors from
 * the product palette (ink #18181b, hoop #f24e1e, gold #f59e0b / #fbbf24). */

function welcomeHtml(contact: string): string {
  return `
  <div style="background:#f4f5f7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;width:100%;">
      <tr>
        <td style="background:#18181b;border-radius:16px 16px 0 0;padding:28px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px;">SportsHub</span>
          <span style="display:inline-block;background:#f24e1e;color:#ffffff;font-size:18px;font-weight:bold;border-radius:5px;padding:2px 7px;margin-left:6px;">One</span>
          <div style="height:3px;width:56px;background:#fbbf24;border-radius:2px;margin-top:16px;"></div>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:32px;">
          <h1 style="margin:0 0 14px;color:#18181b;font-size:26px;line-height:1.25;">You&#39;re on the list.</h1>
          <p style="margin:0 0 16px;color:#3a3a42;font-size:16px;line-height:1.6;">
            SportsHub One opens this fall. You asked to hear when it does, and you will:
            one message when the doors open, nothing else in between.
          </p>
          <p style="margin:0 0 24px;color:#3a3a42;font-size:16px;line-height:1.6;">
            Until then, the demos show the whole thing working: live games on a family&#39;s phone,
            a season planned and published, a club run without spreadsheets.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
            <tr>
              <td style="background:#f59e0b;border-radius:999px;">
                <a href="${BRAND_URL}/demos" style="display:inline-block;padding:12px 28px;color:#18181b;font-size:16px;font-weight:bold;text-decoration:none;">Watch the demos</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:0 32px 28px;">
          <hr style="border:none;border-top:1px solid #eeeef1;margin:0 0 14px;" />
          <p style="margin:0;color:#9191a1;font-size:12px;line-height:1.6;">
            Sent by SportsHub One because this address signed up at ${PRIMARY_DOMAIN}.
            Questions: <a href="mailto:${brandEmail("support")}" style="color:#747486;">${brandEmail("support")}</a>.<br/>
            Not you, or changed your mind?
            <a href="${launchUnsubUrl(contact)}" style="color:#747486;">Take me off the list</a>.
          </p>
        </td>
      </tr>
    </table>
  </div>`
}

export function sendLaunchWelcome(input: { contact: string; kind: string }) {
  if (input.kind === "email") {
    sendEmail({
      to: input.contact,
      subject: "You're on the list. SportsHub One opens this fall.",
      html: welcomeHtml(input.contact),
      text:
        "You're on the list. SportsHub One opens this fall: one message when the doors open, nothing else in between. " +
        `Until then, watch the demos: ${BRAND_URL}/demos ` +
        `Changed your mind? ${launchUnsubUrl(input.contact)}`,
      replyTo: brandEmail("support"),
    }).catch((e) => console.error("Launch welcome email failed:", e))
    return
  }
  if (input.kind === "phone" && smsEnabled()) {
    sendSms({
      to: input.contact.startsWith("+") ? input.contact : `+${input.contact}`,
      body: `SportsHub One: you're on the launch list. One text when we open this fall. The demos: ${BRAND_URL}/demos Reply STOP to opt out.`,
    }).catch((e) => console.error("Launch welcome SMS failed:", e))
  }
}
