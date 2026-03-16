"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const refereeProfileSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]),
  standardFee: z.coerce.number().min(0, "Fee must be a positive number"),
  availableRegions: z.string().min(1, "Enter at least one region"),
})

type RefereeProfileFormData = z.infer<typeof refereeProfileSchema>

export default function RefereeProfilePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RefereeProfileFormData>({
    resolver: zodResolver(refereeProfileSchema),
  })

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/referee/profile")
        if (res.ok) {
          const data = await res.json()
          reset({
            certificationLevel: data.certificationLevel || "",
            standardFee: Number(data.standardFee) || 0,
            availableRegions: (data.availableRegions || []).join(", "),
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

  const onSubmit = async (data: RefereeProfileFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/referee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          availableRegions: data.availableRegions
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
        }),
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
        <p className="text-gray-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Referee Profile</h1>
        <p className="mb-6 text-sm text-gray-600">
          Update your certification, fee, and availability.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="certificationLevel" className="block text-sm font-medium text-gray-700">
              Certification Level <span className="text-red-500">*</span>
            </label>
            <select
              {...register("certificationLevel")}
              id="certificationLevel"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">Select level</option>
              <option value="Level 1">Level 1 — Entry</option>
              <option value="Level 2">Level 2 — Intermediate</option>
              <option value="Level 3">Level 3 — Advanced</option>
            </select>
            {errors.certificationLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.certificationLevel.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="standardFee" className="block text-sm font-medium text-gray-700">
              Standard Fee per Game ($) <span className="text-red-500">*</span>
            </label>
            <input
              {...register("standardFee")}
              type="number"
              id="standardFee"
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="50.00"
            />
            {errors.standardFee && (
              <p className="mt-1 text-sm text-red-600">{errors.standardFee.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="availableRegions" className="block text-sm font-medium text-gray-700">
              Available Regions <span className="text-red-500">*</span>
            </label>
            <input
              {...register("availableRegions")}
              type="text"
              id="availableRegions"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="California, Nevada, Arizona"
            />
            <p className="mt-1 text-xs text-gray-500">
              Separate multiple regions with commas.
            </p>
            {errors.availableRegions && (
              <p className="mt-1 text-sm text-red-600">{errors.availableRegions.message}</p>
            )}
          </div>

          <div className="flex gap-4 pt-2">
            <Link
              href="/dashboard"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-orange-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
