"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CountryStateSelector } from "@/components/country-state-selector"

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(7, "Enter a valid phone number").max(20),
  country: z.string().length(2).default("CA"),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State/Province is required").max(100),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfileEditPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { country: "CA" },
  })

  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          reset({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            phoneNumber: data.phoneNumber || "",
            country: data.country || "CA",
            city: data.city || "",
            state: data.state || "",
          })
        }
      } catch {
        setError("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [reset])

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update profile")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl p-6 md:p-8">
      <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        <h1 className="text-ink-900 mb-2 text-2xl font-semibold">Edit Profile</h1>
        <p className="text-ink-700 mb-6 text-sm">Update your personal information.</p>

        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-4 rounded-lg border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-court-50 text-court-700 mb-4 rounded-lg border border-green-200 p-3 text-sm">
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className={labelClass}>
                First Name <span className="text-red-500">*</span>
              </label>
              <input {...register("firstName")} type="text" id="firstName" className={inputClass} />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className={labelClass}>
                Last Name <span className="text-red-500">*</span>
              </label>
              <input {...register("lastName")} type="text" id="lastName" className={inputClass} />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="phoneNumber" className={labelClass}>
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              {...register("phoneNumber")}
              type="tel"
              id="phoneNumber"
              className={inputClass}
              placeholder="(555) 123-4567"
            />
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
            )}
          </div>

          <CountryStateSelector
            countryValue={watch("country") || "CA"}
            stateValue={watch("state") || ""}
            onCountryChange={(country) => setValue("country", country)}
            onStateChange={(state) => setValue("state", state)}
            countryError={errors.country?.message}
            stateError={errors.state?.message}
          />

          <div>
            <label htmlFor="city" className={labelClass}>
              City <span className="text-red-500">*</span>
            </label>
            <input
              {...register("city")}
              type="text"
              id="city"
              className={inputClass}
              placeholder="Toronto"
            />
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
          </div>

          <div className="flex gap-4 pt-2">
            <Link
              href="/dashboard"
              className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-4 py-2.5 font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2.5 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
