import { z } from "zod"

export const parentOnboardingSchema = z.object({
  type: z.literal("Parent"),
  phoneNumber: z.string().min(7, "Enter a valid phone number").max(20),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
})

export const playerOnboardingSchema = z.object({
  type: z.literal("Player"),
  dateOfBirth: z.string().refine(
    (val) => {
      const dob = new Date(val)
      const today = new Date()
      let age = today.getFullYear() - dob.getFullYear()
      const monthDiff = today.getMonth() - dob.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--
      }
      return age >= 13
    },
    { message: "You must be at least 13 years old to create an account" }
  ),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  jerseyNumber: z.string().optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  height: z.string().max(10).optional(),
  position: z.string().max(50).optional(),
})

export const staffOnboardingSchema = z.object({
  type: z.literal("Staff"),
  phoneNumber: z.string().min(7, "Enter a valid phone number").max(20),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
})

export const refereeOnboardingSchema = z.object({
  type: z.literal("Referee"),
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]),
  standardFee: z.coerce.number().min(0, "Fee must be a positive number"),
  availableRegions: z.string().min(1, "Enter at least one region"),
})

export const leagueOwnerOnboardingSchema = z.object({
  type: z.literal("LeagueOwner"),
  name: z.string().min(1, "League name is required").max(100),
  season: z.string().min(1, "Season is required"),
  description: z.string().optional(),
})

export const profileDataSchema = z.discriminatedUnion("type", [
  parentOnboardingSchema,
  playerOnboardingSchema,
  staffOnboardingSchema,
  refereeOnboardingSchema,
  leagueOwnerOnboardingSchema,
])

export type ParentOnboardingData = z.infer<typeof parentOnboardingSchema>
export type PlayerOnboardingData = z.infer<typeof playerOnboardingSchema>
export type StaffOnboardingData = z.infer<typeof staffOnboardingSchema>
export type RefereeOnboardingData = z.infer<typeof refereeOnboardingSchema>
export type LeagueOwnerOnboardingData = z.infer<typeof leagueOwnerOnboardingSchema>
export type ProfileData = z.infer<typeof profileDataSchema>
