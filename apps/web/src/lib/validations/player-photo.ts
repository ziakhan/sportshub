import { z } from "zod"

/**
 * The player head shot travels as a data URL (same no-blob-infra pattern as
 * club logos, see components/club-page/image-upload-field.tsx). The browser
 * downscales to PLAYER_PHOTO_MAX_EDGE before encoding, so a legitimate upload
 * lands well under the cap below; the cap exists to stop a hand-rolled POST
 * from parking a megabyte of base64 in a text column.
 *
 * COPPA / consent note: this is uploaded by the ACCOUNT HOLDER — the guardian
 * who owns the player row, or a 13+ player on their own profile. Both write
 * paths (PATCH /api/players/[id], POST /api/onboarding) already resolve the
 * row from the session, so there is no way to attach a photo to someone
 * else's child.
 */

/** Longest edge the browser downscales a head shot to before encoding. */
export const PLAYER_PHOTO_MAX_EDGE = 512

/** ~750KB of base64, roughly 10x what a 512px WebP head shot actually costs. */
export const PLAYER_PHOTO_MAX_CHARS = 750_000

export const playerPhotoUrlSchema = z
  .string()
  .max(PLAYER_PHOTO_MAX_CHARS, "That photo is too large. Try a smaller image.")
  .refine((v) => v.startsWith("data:image/") || v.startsWith("https://"), {
    message: "Photo must be an uploaded image",
  })
  .nullable()
  .optional()
