import { z } from "zod"

export function normalizedEmailSchema(message = "Invalid email") {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.string().email(message)
  )
}
