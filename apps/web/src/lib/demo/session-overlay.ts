import { prisma } from "@youthbasketballhub/db"

/**
 * Session-scoped demo actions (limited-launch-demo-build-2026-08.md §3).
 * A demo visitor's whitelisted writes land here — never in real tables —
 * keyed by the demoSessionId from their demo-view cookie, visible only to
 * that session, purged at the nightly reset.
 *
 * Ghost replies are lazily materialized at READ time: a visitor chat
 * message older than the delay with no reply yet gains one on the next
 * fetch. No timers, nothing to crash, survives restarts.
 */

export type DemoActionType =
  | "CHAT_MESSAGE"
  | "GHOST_REPLY"
  | "RSVP"
  | "OFFER_ACCEPT"
  | "POLL_VOTE"

const GHOST_DELAY_MS = 8_000

/** Spec §6 — canned coach replies, rotated per message. */
const GHOST_REPLIES = [
  "Sounds good, see you Saturday. Game's at The Yard, court 2.",
  "Thanks for the heads up!",
  "Check the calendar — everything's up to date there.",
  "Good question — it's all on the team page.",
]

const GHOST_RSVP_DECLINE = "No problem, thanks for letting me know."
const GHOST_OFFER_WELCOME =
  "Welcome to the team! Jersey sizes are in your offer — see you at first practice."

export async function recordDemoAction(
  demoSessionId: string,
  type: DemoActionType,
  targetId: string,
  payload?: Record<string, unknown>
) {
  return (prisma as any).demoSessionAction.create({
    data: { demoSessionId, type, targetId, payload: payload ?? {} },
  })
}

/**
 * Chat overlay for one thread: the visitor's messages plus ghost replies,
 * materializing any reply that has come due. Returned oldest-first.
 */
export async function chatOverlay(demoSessionId: string, targetId: string) {
  const rows = await (prisma as any).demoSessionAction.findMany({
    where: { demoSessionId, targetId, type: { in: ["CHAT_MESSAGE", "GHOST_REPLY"] } },
    orderBy: { createdAt: "asc" },
  })

  const messages = rows.filter((r: any) => r.type === "CHAT_MESSAGE")
  const replies = rows.filter((r: any) => r.type === "GHOST_REPLY")
  const repliedTo = new Set(replies.map((r: any) => (r.payload as any)?.replyToActionId))

  const due = messages.filter(
    (m: any) =>
      !repliedTo.has(m.id) && Date.now() - new Date(m.createdAt).getTime() > GHOST_DELAY_MS
  )

  const created: any[] = []
  for (const m of due) {
    const declined = (m.payload as any)?.rsvpDecline === true
    const text = declined
      ? GHOST_RSVP_DECLINE
      : GHOST_REPLIES[
          // Stable rotation: same message always earns the same reply.
          Math.abs(hashCode(m.id)) % GHOST_REPLIES.length
        ]
    created.push(
      await recordDemoAction(demoSessionId, "GHOST_REPLY", targetId, {
        replyToActionId: m.id,
        text,
      })
    )
  }

  return [...rows, ...created].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

/** Latest RSVP the visitor set on an event (or null). */
export async function rsvpOverlay(demoSessionId: string, targetId: string) {
  return (prisma as any).demoSessionAction.findFirst({
    where: { demoSessionId, targetId, type: "RSVP" },
    orderBy: { createdAt: "desc" },
  })
}

/** Whether this session accepted the staged offer; welcome msg on accept. */
export async function acceptOfferOverlay(demoSessionId: string, offerId: string) {
  const existing = await (prisma as any).demoSessionAction.findFirst({
    where: { demoSessionId, targetId: offerId, type: "OFFER_ACCEPT" },
  })
  if (existing) return { accepted: true, welcome: GHOST_OFFER_WELCOME, already: true }
  await recordDemoAction(demoSessionId, "OFFER_ACCEPT", offerId, {})
  return { accepted: true, welcome: GHOST_OFFER_WELCOME, already: false }
}

/** Nightly-reset hook: drop everything older than the given hours. */
export async function purgeDemoActions(olderThanHours = 24) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000)
  return (prisma as any).demoSessionAction.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
