import Anthropic from "@anthropic-ai/sdk"

/**
 * Claude vision pre-screen for the ONE custom-photo slot on shared cards —
 * the single bounded exception to "no user imagery" (social-feed-plan).
 * Checks the photo is appropriate for a youth sports card.
 *
 * DECISION (2026-07-22, owner asleep): fail-OPEN when no ANTHROPIC_API_KEY
 * is configured (dev/local) — the photo is still consent-gated by
 * mediaConsent and report/takedown applies. Flip STRICT_SCREEN to true
 * before public launch so missing-key environments hold photos as PENDING.
 */
const STRICT_SCREEN = false
const SCREEN_MODEL = "claude-haiku-4-5-20251001"

export type ScreenResult = "APPROVED" | "REJECTED" | "PENDING"

export async function screenCustomPhoto(dataUrl: string): Promise<ScreenResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("photo-screen: no ANTHROPIC_API_KEY — photo not screened")
    return STRICT_SCREEN ? "PENDING" : "APPROVED"
  }
  const match = dataUrl.match(/^data:image\/(webp|jpeg|png);base64,(.+)$/)
  if (!match) return "REJECTED"

  try {
    const client = new Anthropic()
    const res = await client.messages.create({
      model: SCREEN_MODEL,
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: `image/${match[1]}` as "image/webp" | "image/jpeg" | "image/png",
                data: match[2],
              },
            },
            {
              type: "text",
              text: "This photo will appear on a youth basketball player's public stat card. Answer with exactly one word. Reply OK if it is an ordinary, appropriate photo (a person, a game, a team, a basketball scene). Reply NO if it contains nudity, violence, weapons, drugs, alcohol, offensive gestures/symbols/text, or anything else inappropriate for a children's sports platform.",
            },
          ],
        },
      ],
    })
    const text = res.content[0]?.type === "text" ? res.content[0].text.trim().toUpperCase() : ""
    return text.startsWith("OK") ? "APPROVED" : "REJECTED"
  } catch (err) {
    console.error("photo-screen failed:", err)
    return STRICT_SCREEN ? "PENDING" : "APPROVED"
  }
}
