import { z } from "zod"

export const tryoutSignupSchema = z.object({
  playerId: z.string().uuid("Select a player"),
  notes: z.string().max(500).optional(),
})

export type TryoutSignupFormData = z.infer<typeof tryoutSignupSchema>

export const addPlayerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  dateOfBirth: z.string().refine(
    (val) => {
      const date = new Date(val)
      return !isNaN(date.getTime()) && date < new Date()
    },
    { message: "Enter a valid date of birth" }
  ),
  gender: z.enum(["MALE", "FEMALE", "COED"], {
    required_error: "Select a gender",
  }),
  jerseyNumber: z.string().max(10).optional(),
})

export type AddPlayerFormData = z.infer<typeof addPlayerSchema>
