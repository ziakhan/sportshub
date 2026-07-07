import { prisma } from "@youthbasketballhub/db"

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
  | "jersey_assigned"
  // Staff invitations & requests
  | "staff_invite"
  | "invite_accepted"
  | "invite_declined"
  | "staff_request"
  | "request_accepted"
  | "request_declined"
  // Player invitations (G3)
  | "player_invite"
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
  | "schedule_published"
  // Program signups
  | "signup_received"
  | "tryout_unpublished"
  // Game changes
  | "game_cancelled"
  | "game_rescheduled"
  // Team chat (debounced — one unread bell per channel)
  | "team_chat"
  // Team polls & surveys (one bell per poll created)
  | "team_poll"
  // League roster change flow
  | "roster_change_requested"
  | "roster_change_approved"
  | "roster_change_denied"
  | "roster_updated"
  // Referee booking (Uber-style session-day offers)
  | "referee_request"
  | "referee_request_accepted"
  | "referee_request_declined"

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
