import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canActForPlayer } from "@/lib/authz/player-scope"

/**
 * Shared validation for sharing a player's card as a story or profile post
 * (social-feed-plan P4). Players/parents can only ever share the gated,
 * system-generated cards for games the player actually appeared in.
 */

export const shareCardSchema = z.object({
  playerId: z.string(),
  gameId: z.string(),
  cardType: z.enum(["STAT_CARD", "POTG"]),
  visibility: z.enum(["PUBLIC", "FOLLOWERS"]).default("FOLLOWERS"),
  templateId: z.enum(["bold", "clean"]).optional(),
  // Same capped data-URL contract as the POTG table photo
  customPhotoUrl: z
    .string()
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/)
    .max(2_000_000)
    .optional(),
})
export type ShareCardInput = z.infer<typeof shareCardSchema>

export type ShareCardCheck =
  | { ok: true; visibility: "PUBLIC" | "FOLLOWERS"; playerName: string }
  | { ok: false; error: string; code: string; httpStatus: number }

export async function checkCardShare(userId: string, input: ShareCardInput): Promise<ShareCardCheck> {
  if (!(await canActForPlayer(userId, input.playerId))) {
    return { ok: false, error: "You can only share your own player's cards", code: "NOT_YOUR_PLAYER", httpStatus: 403 }
  }

  const [game, stat, player] = await Promise.all([
    (prisma as any).game.findUnique({
      where: { id: input.gameId },
      select: { status: true, potgPlayerId: true },
    }),
    (prisma as any).playerStat.findUnique({
      where: { gameId_playerId: { gameId: input.gameId, playerId: input.playerId } },
      select: { id: true },
    }),
    (prisma as any).player.findUnique({
      where: { id: input.playerId },
      select: { socialVisibility: true, firstName: true, lastName: true },
    }),
  ])

  if (!game || game.status !== "COMPLETED" || !player) {
    return { ok: false, error: "Game not finished", code: "NOT_FINAL", httpStatus: 400 }
  }
  if (input.cardType === "POTG" && game.potgPlayerId !== input.playerId) {
    return { ok: false, error: "This player was not the Player of the Game", code: "NOT_POTG", httpStatus: 400 }
  }
  if (input.cardType === "STAT_CARD" && !stat) {
    return { ok: false, error: "No stat line for this player in this game", code: "NO_STATS", httpStatus: 400 }
  }

  // PUBLIC distribution only for PUBLIC players — otherwise clamp, never fail
  const visibility =
    input.visibility === "PUBLIC" && player.socialVisibility === "PUBLIC" ? "PUBLIC" : "FOLLOWERS"

  return {
    ok: true,
    visibility,
    playerName: `${player.firstName} ${player.lastName}`.trim(),
  }
}
