import Anthropic from "@anthropic-ai/sdk"
import type { RecapInput, RecapResult } from "./recap"
import { analyzeGame } from "./recap"

/**
 * Claude-written game recap (plan §6.1). Optional upgrade over the template:
 * when ANTHROPIC_API_KEY isn't configured (or the call fails), return null and
 * the caller falls back to buildTemplateRecap — recaps always publish.
 *
 * Player names in RecapInput are already privacy-safe (publicPlayerName);
 * the model only ever sees what the public page would show.
 */

export const RECAP_MODEL = process.env.RECAP_AI_MODEL || "claude-opus-4-8"

const RECAP_SCHEMA = {
  type: "object" as const,
  properties: {
    title: {
      type: "string" as const,
      description: "Headline, e.g. 'Raptors edge Hawks 52–50'. Include the final score.",
    },
    body: {
      type: "string" as const,
      description: "The recap text: 120–180 words, newspaper game-story style, single paragraph.",
    },
  },
  required: ["title", "body"],
  additionalProperties: false,
}

export async function generateRecapWithClaude(input: RecapInput): Promise<RecapResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const client = new Anthropic({ timeout: 45_000, maxRetries: 1 })
    const shape = analyzeGame(input)

    const facts = {
      finalScore: `${input.homeTeam.name} ${input.homeScore} — ${input.awayScore} ${input.awayTeam.name} (home team listed first)`,
      winner: shape.winner.name,
      margin: shape.margin,
      leadChanges: shape.leadChanges,
      biggestRun: shape.biggestRun
        ? {
            team: shape.biggestRun.teamId === input.homeTeam.id ? input.homeTeam.name : input.awayTeam.name,
            points: shape.biggestRun.points,
            period: shape.biggestRun.period,
            periodType: input.periodType ?? "QUARTERS",
          }
        : null,
      league: input.leagueName ?? null,
      season: input.seasonLabel ?? null,
      date: input.dateLabel ?? null,
      topPerformers: input.playerLines
        .filter((p) => p.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 6)
        .map((p) => ({
          name: p.name,
          team: p.teamId === input.homeTeam.id ? input.homeTeam.name : input.awayTeam.name,
          points: p.points,
          rebounds: p.rebounds,
          assists: p.assists,
        })),
    }

    const response = await client.messages.create({
      model: RECAP_MODEL,
      max_tokens: 1024,
      system:
        "You write short youth-basketball game recaps for a community sports site. " +
        "Newspaper game-story style: energetic but factual, positive framing for BOTH teams " +
        "(these are kids — never mock or single out a poor performance), no invented details. " +
        "Use ONLY the facts provided. Use player names exactly as given.",
      messages: [
        {
          role: "user",
          content: `Write a recap of this game:\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: RECAP_SCHEMA },
      },
    })

    const text = response.content.find((b) => b.type === "text")
    if (!text || text.type !== "text") return null
    const parsed = JSON.parse(text.text) as { title?: string; body?: string }
    if (!parsed.title || !parsed.body) return null
    return { title: parsed.title, body: parsed.body }
  } catch (err) {
    console.error("Claude recap generation failed; falling back to template:", err)
    return null
  }
}
