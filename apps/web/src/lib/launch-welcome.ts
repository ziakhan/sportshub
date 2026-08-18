import crypto from "crypto"
import { sendEmail, escapeHtml } from "@/lib/email"
import { sendSms, smsEnabled, toE164 } from "@/lib/sms"
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
 * the product palette (ink #18181b, hoop #f24e1e, gold #f59e0b / #fbbf24).
 * The hero band is a rendered composite of real product screens, hosted on
 * the brand domain (public/email/welcome-hero.png, authored-HTML pipeline). */

function bullet(lead: string, rest: string): string {
  return `
  <tr>
    <td style="width:22px;vertical-align:top;padding:7px 0;">
      <div style="width:9px;height:9px;border-radius:999px;background:#f59e0b;margin-top:6px;"></div>
    </td>
    <td style="padding:6px 0;color:#3a3a42;font-size:15.5px;line-height:1.55;">
      <strong style="color:#18181b;">${lead}</strong> ${rest}
    </td>
  </tr>`
}

/** One sentence that matches who they said they are. */
function identityLine(identity: string | null): string {
  if (identity === "Club") {
    return `<p style="margin:0 0 22px;color:#3a3a42;font-size:15.5px;line-height:1.6;">
      You signed up as a club. Odds are your club is already listed with 1,325 others across Canada:
      <a href="${BRAND_URL}/club" style="color:#d97706;font-weight:bold;">find it and claim it</a>
      before launch so families find you on day one.</p>`
  }
  if (identity === "League") {
    return `<p style="margin:0 0 22px;color:#3a3a42;font-size:15.5px;line-height:1.6;">
      You signed up as a league. The season demo shows a full league planned, scheduled and
      published in one sitting. That one is worth your three minutes.</p>`
  }
  if (identity === "Referee") {
    return `<p style="margin:0 0 22px;color:#3a3a42;font-size:15.5px;line-height:1.6;">
      You signed up as a referee. Assignments, availability and game-day sign-off all live in
      the same place the games do. The referees demo shows the whole shift.</p>`
  }
  return ""
}

function welcomeHtml(contact: string, identity: string | null): string {
  return `
  <div style="background:#f4f5f7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;width:100%;">
      <tr>
        <td style="background:#18181b;border-radius:16px 16px 0 0;padding:22px 32px 16px;">
          <a href="${BRAND_URL}">
            <img src="${BRAND_URL}/brand/wordmark-one-reverse.png" width="178" height="50" alt="SportsHub ONE"
              style="display:block;border:0;" />
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#18181b;">
          <a href="${BRAND_URL}/demos">
            <img src="${BRAND_URL}/email/welcome-hero.png" width="600" alt="Live scores, family calendars and game recaps on real phones"
              style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:30px 32px 8px;">
          <h1 style="margin:0 0 12px;color:#18181b;font-size:27px;line-height:1.25;">You&#39;re on the list.</h1>
          <p style="margin:0 0 20px;color:#3a3a42;font-size:16px;line-height:1.6;">
            SportsHub One opens this fall, and you asked to hear when it does.
            You will: one message when the doors open, nothing else in between.
            Here is what will be waiting for you.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;">
            ${bullet("Every game, live on your phone.", "Score, box score and play-by-play as it happens, from any gym.")}
            ${bullet("One calendar that runs itself.", "Practices, games, payments and waivers for the whole family in one place.")}
            ${bullet("Everyone gets their page.", "Standings, written game recaps and a page for every club, team and player.")}
          </table>
          ${identityLine(identity)}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 10px;">
            <tr>
              <td style="background:#f59e0b;border-radius:999px;">
                <a href="${BRAND_URL}/demos" style="display:inline-block;padding:13px 34px;color:#18181b;font-size:16px;font-weight:bold;text-decoration:none;">Watch it working</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 6px;text-align:center;color:#9191a1;font-size:13px;">
            Short walkthroughs of the real screens. No account needed.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:14px 32px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f7f7f8;border-radius:12px;">
            <tr>
              <td style="padding:14px 18px;text-align:center;color:#5e5e6e;font-size:13.5px;line-height:1.6;">
                <strong style="color:#18181b;">1,325 Canadian clubs</strong> already listed
                &nbsp;·&nbsp; live scoring &nbsp;·&nbsp; free for families to follow<br/>
                Add this address to your contacts so launch day lands in your inbox.
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:0 32px 26px;">
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

export function sendLaunchWelcome(input: { contact: string; kind: string; identity?: string | null }) {
  if (input.kind === "email") {
    sendEmail({
      to: input.contact,
      subject: "You're on the list. SportsHub One opens this fall.",
      html: welcomeHtml(input.contact, input.identity ?? null),
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
      to: toE164(input.contact),
      body: `SportsHub One: you're on the launch list. One text when we open this fall. The demos: ${BRAND_URL}/demos Reply STOP to opt out.`,
    }).catch((e) => console.error("Launch welcome SMS failed:", e))
  }
}
