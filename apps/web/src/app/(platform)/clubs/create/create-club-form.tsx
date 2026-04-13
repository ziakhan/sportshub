"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { CountryStateSelector } from "@/components/country-state-selector"
import { getCountryConfig, getCurrencyForCountry, getTimezonesForCountry } from "@/lib/countries"

const createClubSchema = z.object({
  name: z.string().min(3, "Club name must be at least 3 characters").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
  country: z.string().length(2).default("CA"),
  currency: z.string().length(3).default("CAD"),
  timezone: z.string(),
  phoneNumber: z.string().min(7, "Enter a valid phone number").max(20),
  contactEmail: z.string().email("Enter a valid email address"),
  address: z.string().min(3, "Address is required"),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  zipCode: z.string().min(3, "Enter a valid postal code").max(10),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
})

type CreateClubFormData = z.infer<typeof createClubSchema>

export function CreateClubForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdClub, setCreatedClub] = useState<{ name: string; subdomain: string } | null>(null)

  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
  const helperClass = "mt-1 text-sm text-ink-500"
  const sectionClass = "border-t border-ink-200 pt-6"

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateClubFormData>({
    resolver: zodResolver(createClubSchema),
    defaultValues: {
      country: "CA",
      currency: "CAD",
      timezone: "America/Toronto",
    },
  })

  // Auto-generate slug from club name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  const onSubmit = async (data: CreateClubFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create club")
      }

      const result = await response.json()
      setCreatedClub({ name: data.name, subdomain: result.subdomain })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  if (createdClub) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-ink-900 mb-2 text-xl font-semibold">Club Created!</h2>
        <p className="text-ink-600 mb-1">
          <span className="font-semibold">{createdClub.name}</span> is ready to go.
        </p>
        <p className="text-ink-500 mb-6 text-sm">
          Your club URL: <span className="text-play-700 font-mono">{createdClub.subdomain}</span>
        </p>
        <a
          href={`http://${createdClub.subdomain}/dashboard`}
          className="bg-play-600 hover:bg-play-700 inline-block w-full rounded-xl px-4 py-2 text-center font-semibold text-white transition"
        >
          Go to Club Dashboard
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="border-hoop-200 rounded-xl border bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Club Name */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Club Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register("name")}
          type="text"
          id="name"
          className={inputClass}
          placeholder="Warriors Basketball Club"
          onBlur={(e) => {
            if (!watch("slug")) {
              setValue("slug", generateSlug(e.target.value))
            }
          }}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className={labelClass}>
          Subdomain Slug <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 flex rounded-xl shadow-sm">
          <input
            {...register("slug")}
            type="text"
            id="slug"
            className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 block w-full rounded-l-xl border px-3 py-2 focus:outline-none focus:ring-2"
            placeholder="warriors"
          />
          <span className="border-ink-200 bg-court-50 text-ink-500 inline-flex items-center rounded-r-xl border border-l-0 px-3 text-sm">
            .youthbasketballhub.com
          </span>
        </div>
        {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>}
        <p className={helperClass}>
          This will be your club&apos;s unique URL. Only lowercase letters, numbers, and hyphens.
        </p>
      </div>

      {/* Contact Info Section */}
      <div className={sectionClass}>
        <h3 className="text-ink-900 mb-4 text-lg font-semibold">Contact Information</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="phoneNumber" className={labelClass}>
                Business Phone <span className="text-red-500">*</span>
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

            <div>
              <label htmlFor="contactEmail" className={labelClass}>
                Contact Email <span className="text-red-500">*</span>
              </label>
              <input
                {...register("contactEmail")}
                type="email"
                id="contactEmail"
                className={inputClass}
                placeholder="info@warriors.com"
              />
              {errors.contactEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.contactEmail.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="website" className={labelClass}>
              Website (Optional)
            </label>
            <input
              {...register("website")}
              type="url"
              id="website"
              className={inputClass}
              placeholder="https://www.warriors.com"
            />
            {errors.website && (
              <p className="mt-1 text-sm text-red-600">{errors.website.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className={sectionClass}>
        <h3 className="text-ink-900 mb-4 text-lg font-semibold">Business Address</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="address" className={labelClass}>
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              {...register("address")}
              type="text"
              id="address"
              className={inputClass}
              placeholder="123 Basketball Ave"
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>

          <CountryStateSelector
            countryValue={watch("country") || "US"}
            stateValue={watch("state") || ""}
            onCountryChange={(country) => {
              setValue("country", country)
              setValue("currency", getCurrencyForCountry(country))
              // Reset timezone to first option for new country
              const tzs = getTimezonesForCountry(country)
              if (tzs.length > 0) setValue("timezone", tzs[0].value)
            }}
            onStateChange={(state) => setValue("state", state)}
            countryError={errors.country?.message}
            stateError={errors.state?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className={labelClass}>
                City <span className="text-red-500">*</span>
              </label>
              <input
                {...register("city")}
                type="text"
                id="city"
                className={inputClass}
                placeholder="Los Angeles"
              />
              {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
            </div>

            <div>
              <label htmlFor="zipCode" className={labelClass}>
                {getCountryConfig(watch("country") || "US")?.postalLabel || "Postal Code"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                {...register("zipCode")}
                type="text"
                id="zipCode"
                className={inputClass}
                placeholder={watch("country") === "CA" ? "A1A 1A1" : "90001"}
              />
              {errors.zipCode && (
                <p className="mt-1 text-sm text-red-600">{errors.zipCode.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Branding Section */}
      <div className={sectionClass}>
        <h3 className="text-ink-900 mb-4 text-lg font-semibold">Branding</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="logoUrl" className={labelClass}>
              Logo URL (Optional)
            </label>
            <input
              {...register("logoUrl")}
              type="url"
              id="logoUrl"
              className={inputClass}
              placeholder="https://example.com/logo.png"
            />
            {errors.logoUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.logoUrl.message}</p>
            )}
            <p className={helperClass}>
              Paste a link to your club logo. You can update this later.
            </p>
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description (Optional)
            </label>
            <textarea
              {...register("description")}
              id="description"
              rows={3}
              className={inputClass}
              placeholder="Elite youth basketball program focused on skill development and competitive play..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className={labelClass}>
          Timezone <span className="text-red-500">*</span>
        </label>
        <select {...register("timezone")} id="timezone" className={inputClass}>
          {getTimezonesForCountry(watch("country") || "US").map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        {errors.timezone && <p className="mt-1 text-sm text-red-600">{errors.timezone.message}</p>}
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-play-600 hover:bg-play-700 focus:ring-play-500/20 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2 font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating..." : "Create Club"}
        </button>
        <Link
          href="/dashboard"
          className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-4 py-2 font-semibold shadow-sm transition"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
