import { z } from "zod"

/**
 * Structured application questions (owner 2026-07-31): a question is a
 * DEFINED thing — label + input type (+ options for choice types) — not a
 * plain text line. Stored as Json on Season.applicationQuestions and inside
 * Organization.seasonDefaults; legacy plain-string questions normalize to a
 * required paragraph answer, so old data keeps working everywhere.
 */

export type QuestionType = "text" | "long_text" | "single" | "multi"

export interface ApplicationQuestion {
  label: string
  type: QuestionType
  options: string[]
  required: boolean
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short answer",
  long_text: "Paragraph",
  single: "Single choice",
  multi: "Multiple choice",
}

const questionObjectSchema = z.object({
  label: z.string().trim().min(1).max(300),
  type: z.enum(["text", "long_text", "single", "multi"]).default("long_text"),
  options: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  required: z.boolean().default(true),
})

/** Accepts the legacy string form and the structured form side by side. */
export const applicationQuestionsSchema = z.array(
  z.union([z.string().trim().min(1).max(300), questionObjectSchema])
)

/** One shape for every consumer — editors, entry form, answer viewers. */
export function normalizeQuestions(raw: unknown): ApplicationQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: ApplicationQuestion[] = []
  for (const q of raw) {
    if (typeof q === "string") {
      const label = q.trim()
      if (label) out.push({ label, type: "long_text", options: [], required: true })
      continue
    }
    const parsed = questionObjectSchema.safeParse(q)
    if (parsed.success) {
      const needsOptions = parsed.data.type === "single" || parsed.data.type === "multi"
      out.push({
        ...parsed.data,
        options: needsOptions ? parsed.data.options : [],
      })
    }
  }
  return out
}

/** Answer display: multi answers arrive as arrays, everything else a string. */
export function answerToText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ")
  if (value == null || value === "") return "—"
  return String(value)
}

/** Is this answer missing, honoring the question's required flag? */
export function answerMissing(q: ApplicationQuestion, value: unknown): boolean {
  if (!q.required) return false
  if (Array.isArray(value)) return value.length === 0
  return !(typeof value === "string" && value.trim().length > 0)
}
