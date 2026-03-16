"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addPlayerSchema,
  type AddPlayerFormData,
} from "@/lib/validations/tryout-signup"

export default function EditPlayerPage() {
  const router = useRouter()
  const params = useParams()
  const playerId = params?.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
  })

  useEffect(() => {
    async function loadPlayer() {
      try {
        const res = await fetch(`/api/players/${playerId}`)
        if (!res.ok) throw new Error("Failed to load player")
        const data = await res.json()
        reset({
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: new Date(data.dateOfBirth).toISOString().split("T")[0],
          gender: data.gender,
          jerseyNumber: data.jerseyNumber || "",
        })
      } catch {
        setError("Failed to load player")
      } finally {
        setIsLoading(false)
      }
    }
    loadPlayer()
  }, [playerId, reset])

  const onSubmit = async (data: AddPlayerFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update player")
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
        <p className="text-gray-500">Loading player...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Edit Player
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Update your player&apos;s information.
          </p>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Player updated successfully!
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700"
                >
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("firstName")}
                  type="text"
                  id="firstName"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("lastName")}
                  type="text"
                  id="lastName"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="dateOfBirth"
                className="block text-sm font-medium text-gray-700"
              >
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                {...register("dateOfBirth")}
                type="date"
                id="dateOfBirth"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.dateOfBirth && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.dateOfBirth.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-medium text-gray-700"
              >
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                {...register("gender")}
                id="gender"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="COED">Other</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.gender.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="jerseyNumber"
                className="block text-sm font-medium text-gray-700"
              >
                Jersey Number{" "}
                <span className="text-gray-400">(optional)</span>
              </label>
              <input
                {...register("jerseyNumber")}
                type="text"
                id="jerseyNumber"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 23"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
