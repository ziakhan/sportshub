import { z } from "zod"

/**
 * Signup request payload shared by all four program signup APIs.
 *
 * BACK-COMPAT CONTRACT (server never leads the client): fielded app bundles
 * and the old web forms send `{ playerId, weeksSelected? }` — that shape must
 * parse forever. The multi-kid web/native forms send
 * `{ registrations: [{ playerId, weekNumbers? }] }`.
 */

export const registrationEntrySchema = z.object({
  playerId: z.string(),
  /** Camps only: which weeks (1-based). */
  weekNumbers: z.array(z.number().int().min(1)).min(1).optional(),
})

export const signupPayloadSchema = z.object({
  // Legacy single-kid shape
  playerId: z.string().optional(),
  weeksSelected: z.number().int().min(1).optional(),
  // Multi-kid shape
  registrations: z.array(registrationEntrySchema).min(1).max(10).optional(),
  notes: z.string().optional(),
  marketingConsent: z.boolean().optional(),
})

export interface RegistrationEntry {
  playerId: string
  weekNumbers: number[] | null
  /** Count for pricing/back-compat; weekNumbers.length when weeks are explicit. */
  weeksCount: number | null
}

/** Normalize either payload shape to a list of per-kid entries. */
export function normalizeRegistrations(data: z.infer<typeof signupPayloadSchema>): RegistrationEntry[] {
  if (data.registrations?.length) {
    return data.registrations.map((r) => ({
      playerId: r.playerId,
      weekNumbers: r.weekNumbers ?? null,
      weeksCount: r.weekNumbers?.length ?? null,
    }))
  }
  if (data.playerId) {
    return [
      {
        playerId: data.playerId,
        weekNumbers: null,
        weeksCount: data.weeksSelected ?? null,
      },
    ]
  }
  return []
}
