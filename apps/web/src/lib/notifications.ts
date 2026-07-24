import { prisma } from "@youthbasketballhub/db"
import {
  enqueuePushDetached,
  publishRealtimeDetached,
  rooms as rt,
  type PushItem,
} from "@/lib/realtime/publish"

/**
 * In-app notification service — the single write path to Notification.
 *
 * Before this module, 30 call sites hand-built the same create payload with
 * bare string `type` literals; a typo in a type or a schema change meant
 * editing every site. All notification types live in this union — adding a
 * new kind of notification starts here.
 *
 * Pass `db` = the transaction client when the notification must commit
 * atomically with the action that caused it.
 */

export type NotificationType =
  // Offer pipeline
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "offer_rescinded"
  // Reviews (owner 2026-07-18: post-season invite lifecycle)
  | "review_invite"
  | "review_invite_heads_up"
  // Withdrawals (owner 2026-07-18: self-withdrawal needs the other party's sign-off)
  | "withdrawal_request"
  | "withdrawal_decision"
  | "jersey_assigned"
  // Staff invitations & requests
  | "staff_invite"
  | "invite_accepted"
  | "invite_declined"
  | "invite_cancelled"
  | "staff_request"
  | "request_accepted"
  | "request_declined"
  // Player invitations (G3)
  | "player_invite"
  | "family_invite"
  | "team_full"
  | "player_invite_accepted"
  | "player_invite_declined"
  | "player_invite_cancelled"
  // Club claims
  | "club_claim"
  | "claim_approved"
  | "claim_rejected"
  // League / season
  | "league_registration_status"
  | "team_submitted"
  | "submission_request" // coach asks club to register a team (2026-07-15)
  | "submission_request_decided"
  | "roster_change_decided" // league decided a structured roster change
  | "schedule_published"
  // Program signups
  | "signup_received"
  | "signup_cancelled"
  | "registration_confirmed" // family-side confirmation (tryout/camp/HL)
  | "registration_cancelled" // club deleted the program → every registered family
  | "tryout_unpublished"
  // Game changes
  | "game_cancelled"
  | "game_rescheduled"
  | "game_final" // final score to team audiences
  | "game_live" // tip-off — to followers of either team (M3 live-push)
  // Social layer (social-feed-plan P3/P5)
  | "follow_request" // someone asked to follow a private player → guardian
  | "follow_approved" // the guardian approved → requester
  | "post_comment" // new comment on your post → post author
  | "comment_hidden" // a comment auto-hid at the report threshold → post author
  // League lifecycle
  | "season_registration_open"
  // Club announcements
  | "announcement_posted"
  // Team chat (debounced — one unread bell per channel)
  | "team_chat"
  | "direct_message"
  // Team polls & surveys (one bell per poll created)
  | "team_poll"
  // Practice schedule announced / a practice moved, added or cancelled
  | "practice_schedule"
  | "practice_change"
  // Team events (photo day, film session, …) added / changed / cancelled
  | "team_event"
  // Installment payments (payments v2): pre-due reminder, receipt, failure
  | "payment_reminder"
  | "payment_overdue"
  | "payment_receipt"
  | "payment_failed"
  | "payment_refunded"
  | "fee_waived"
  // League roster change flow
  | "roster_change_requested"
  | "roster_change_approved"
  | "roster_change_denied"
  | "roster_updated"
  // Referee booking (Uber-style session-day offers)
  | "referee_request"
  | "referee_request_accepted"
  | "referee_request_declined"
  | "referee_request_cancelled"
  // RSVP: family nudge to answer; staff heads-up on a late "Not going"
  | "rsvp_reminder"
  | "rsvp_change"
  // Waivers: family nudge to sign before the league season starts (7d/24h)
  | "waiver_reminder"
  // Program staff: you were assigned to run a camp / house league
  | "program_assigned"

export interface NotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string | null
  referenceId?: string | null
  referenceType?: string | null
}

type DbClient =
  | Pick<typeof prisma, "notification">
  | {
      notification: {
        create: (args: any) => Promise<unknown>
        createMany: (args: any) => Promise<unknown>
      }
    }

/**
 * Notification types that also go to phones (M3 push). The bell gets
 * everything; push is reserved for the time-sensitive family-facing set so
 * the app doesn't nag (doc §7 triggers list). Chat is already debounced at
 * the notify() call site, so its pushes inherit the one-per-unread cadence.
 */
const PUSH_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "team_chat",
  "follow_request",
  "follow_approved",
  "family_invite",
  "direct_message",
  "submission_request",
  "submission_request_decided",
  "offer_received",
  "offer_rescinded",
  "game_live",
  "game_final",
  "game_cancelled",
  "game_rescheduled",
  "practice_schedule",
  "practice_change",
  "team_event",
  "announcement_posted",
  "rsvp_reminder",
  "rsvp_change",
  // Time-sensitive family action: unsigned waiver blocks play (owner 2026-07-20)
  "waiver_reminder",
])

/**
 * Bell ping to the recipients' private user rooms (M1 realtime seam) plus,
 * for push-enabled types, an M3 push enqueue on the sidecar. Detached on
 * purpose: notify() often runs inside a transaction, and a network call
 * must not hold it open. The socket payload is a ping — the client
 * refetches /api/notifications; content never rides the socket. If the
 * enclosing transaction rolls back, the cost is one spurious refetch (and,
 * worst case, one early push for a write that never landed).
 */
function pingBell(inputs: NotificationInput[]): void {
  const userIds = [...new Set(inputs.map((i) => i.userId))]
  publishRealtimeDetached({
    rooms: userIds.map((id) => rt.user(id)),
    event: "notify",
    payload: { type: inputs[0]?.type },
  })
  const pushable: PushItem[] = inputs
    .filter((i) => PUSH_TYPES.has(i.type))
    .map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      message: i.message,
      link: i.link ?? null,
    }))
  enqueuePushDetached(pushable)
}

/** Create one notification. Use inside transactions by passing the tx client. */
export async function notify(db: DbClient, input: NotificationInput): Promise<void> {
  await (db as any).notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
    },
  })
  pingBell([input])
}

/** Fan the same notification out to several users (e.g. all platform admins). */
export async function notifyMany(
  db: DbClient,
  userIds: string[],
  input: Omit<NotificationInput, "userId">
): Promise<void> {
  if (userIds.length === 0) return
  await (db as any).notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
    })),
  })
  pingBell(userIds.map((userId) => ({ ...input, userId })))
}

/** Create several distinct notifications in one write (createMany). */
export async function notifyBatch(db: DbClient, inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return
  await (db as any).notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
    })),
  })
  // One publish for the whole batch; type is advisory (clients just refetch)
  pingBell(inputs)
}

/**
 * Non-transactional convenience that never throws — for events where the
 * primary action must not fail because a notification write hiccuped.
 */
export async function notifySafe(input: NotificationInput): Promise<void> {
  try {
    await notify(prisma, input)
  } catch (error) {
    console.error("Notification write failed:", input.type, input.userId, error)
  }
}
