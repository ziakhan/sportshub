"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addPlayerSchema,
  type AddPlayerFormData,
} from "@/lib/validations/tryout-signup"

function AddPlayerForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect") ?? null

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPlayer, setCreatedPlayer] = useState<{ name: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
  })

  const onSubmit = async (data: AddPlayerFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to add player")
      }

      setCreatedPlayer({ name: `${data.firstName} ${data.lastName}` })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (createdPlayer) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-xl">
          <div className="rounded-lg bg-white p-8 shadow text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Player Added!</h2>
            <p className="mb-6 text-gray-600">
              <span className="font-semibold">{createdPlayer.name}</span> has been registered.
            </p>
            <div className="flex gap-3">
              <Link
                href={redirectTo || "/players"}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center font-semibold text-white hover:bg-blue-700"
              >
                View My Players
              </Link>
              <button
                onClick={() => {
                  setCreatedPlayer(null)
                  setError(null)
                  reset()
                }}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Add Another Player
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <Link
            href={redirectTo || "/players"}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Players
          </Link>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Add a Player
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Register your child so you can sign them up for tryouts and teams.
          </p>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
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
                  placeholder="First name"
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
                  placeholder="Last name"
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
              <Link
                href={redirectTo || "/players"}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? "Adding..." : "Add Player"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function AddPlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <AddPlayerForm />
    </Suspense>
  )
}
