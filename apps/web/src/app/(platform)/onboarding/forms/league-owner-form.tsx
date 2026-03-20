"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  leagueOwnerOnboardingSchema,
  type LeagueOwnerOnboardingData,
} from "@/lib/validations/onboarding"

interface LeagueOwnerFormProps {
  onSubmit: (data: LeagueOwnerOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
}

export function LeagueOwnerForm({ onSubmit, onBack, isSubmitting }: LeagueOwnerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeagueOwnerOnboardingData>({
    resolver: zodResolver(leagueOwnerOnboardingSchema),
    defaultValues: { type: "LeagueOwner" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          🏆 Create Your League
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Set up your basketball league. You can add divisions and teams later.
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          League Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register("name")}
          type="text"
          id="name"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="Metro Youth Basketball League"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="season" className="block text-sm font-medium text-gray-700">
          Season <span className="text-red-500">*</span>
        </label>
        <input
          {...register("season")}
          type="text"
          id="season"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="Spring 2026"
        />
        {errors.season && (
          <p className="mt-1 text-sm text-red-600">{errors.season.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description (Optional)
        </label>
        <textarea
          {...register("description")}
          id="description"
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="Competitive youth basketball league for ages 8-18..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-purple-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? "Creating league..." : "Create League & Continue"}
        </button>
      </div>
    </form>
  )
}
