"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"

const createClubSchema = z.object({
  name: z.string().min(3, "Club name must be at least 3 characters").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
  timezone: z.string(),
})

type CreateClubFormData = z.infer<typeof createClubSchema>

export function CreateClubForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdClub, setCreatedClub] = useState<{ name: string; subdomain: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateClubFormData>({
    resolver: zodResolver(createClubSchema),
    defaultValues: {
      timezone: "America/New_York",
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
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Club Created!</h2>
        <p className="mb-1 text-gray-600">
          <span className="font-semibold">{createdClub.name}</span> is ready to go.
        </p>
        <p className="mb-6 text-sm text-gray-500">
          Your club URL: <span className="font-mono text-blue-600">{createdClub.subdomain}</span>
        </p>
        <a
          href={`http://${createdClub.subdomain}/dashboard`}
          className="inline-block w-full rounded-md bg-blue-600 px-4 py-2 text-center font-semibold text-white hover:bg-blue-700"
        >
          Go to Club Dashboard
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Club Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Club Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register("name")}
          type="text"
          id="name"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
          Subdomain Slug <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            {...register("slug")}
            type="text"
            id="slug"
            className="block w-full rounded-l-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="warriors"
          />
          <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
            .youthbasketballhub.com
          </span>
        </div>
        {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>}
        <p className="mt-1 text-sm text-gray-500">
          This will be your club&apos;s unique URL. Only lowercase letters, numbers, and hyphens.
        </p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description (Optional)
        </label>
        <textarea
          {...register("description")}
          id="description"
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Elite youth basketball program focused on skill development and competitive play..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
          Timezone <span className="text-red-500">*</span>
        </label>
        <select
          {...register("timezone")}
          id="timezone"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="America/New_York">Eastern Time (ET)</option>
          <option value="America/Chicago">Central Time (CT)</option>
          <option value="America/Denver">Mountain Time (MT)</option>
          <option value="America/Los_Angeles">Pacific Time (PT)</option>
          <option value="America/Phoenix">Arizona (MST)</option>
          <option value="America/Anchorage">Alaska Time</option>
          <option value="Pacific/Honolulu">Hawaii Time</option>
        </select>
        {errors.timezone && (
          <p className="mt-1 text-sm text-red-600">{errors.timezone.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? "Creating..." : "Create Club"}
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 font-semibold shadow-sm hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
