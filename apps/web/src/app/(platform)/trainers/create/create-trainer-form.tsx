"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const createTrainerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z
    .string()
    .min(3, "Link name must be at least 3 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
  bio: z.string().max(2000).optional(),
  phoneNumber: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email"),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "Province is required").max(100),
})

type CreateTrainerFormData = z.infer<typeof createTrainerSchema>

export function CreateTrainerForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string
  defaultEmail: string
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
  const helperClass = "mt-1 text-sm text-ink-500"

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTrainerFormData>({
    resolver: zodResolver(createTrainerSchema),
    defaultValues: {
      name: defaultName ? `${defaultName} Training` : "",
      contactEmail: defaultEmail,
      state: "ON",
    },
  })

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const onSubmit = async (data: CreateTrainerFormData) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to create your trainer profile")
      }
      // Full reload so server layouts pick up the fresh role
      window.location.href = `/clubs/${result.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="border-hoop-200 text-hoop-700 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>
          Training business name
        </label>
        <input
          id="name"
          {...register("name")}
          onBlur={(e) => {
            if (!watch("slug")) setValue("slug", generateSlug(e.target.value))
          }}
          placeholder="Jordan Smith Training"
          className={inputClass}
        />
        <p className={helperClass}>Shown on your public page and next to your programs.</p>
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="slug" className={labelClass}>
          Link name
        </label>
        <input id="slug" {...register("slug")} placeholder="jordan-smith-training" className={inputClass} />
        <p className={helperClass}>Your public page address. Lowercase letters, numbers, and dashes.</p>
        {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>}
      </div>

      <div>
        <label htmlFor="bio" className={labelClass}>
          About you <span className="text-ink-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="bio"
          {...register("bio")}
          rows={3}
          placeholder="10 years coaching rep basketball; skills and shooting development for grades 5-12."
          className={inputClass}
        />
        {errors.bio && <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={labelClass}>
            City
          </label>
          <input id="city" {...register("city")} placeholder="Toronto" className={inputClass} />
          {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
        </div>
        <div>
          <label htmlFor="state" className={labelClass}>
            Province
          </label>
          <input id="state" {...register("state")} className={inputClass} />
          {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contactEmail" className={labelClass}>
            Contact email
          </label>
          <input id="contactEmail" type="email" {...register("contactEmail")} className={inputClass} />
          {errors.contactEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.contactEmail.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="phoneNumber" className={labelClass}>
            Phone <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <input id="phoneNumber" {...register("phoneNumber")} className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-4 py-2 font-semibold text-white transition disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create Trainer Profile"}
      </button>
    </form>
  )
}
