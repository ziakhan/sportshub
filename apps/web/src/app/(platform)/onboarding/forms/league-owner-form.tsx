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

  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
  const secondaryButtonClass =
    "rounded-xl border border-ink-200 bg-white px-4 py-2.5 font-semibold text-ink-700 transition hover:bg-court-50"
  const primaryButtonClass =
    "flex-1 rounded-xl bg-play-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-play-700 disabled:cursor-not-allowed disabled:bg-ink-400"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-ink-900 text-xl font-semibold">Create Your League</h2>
        <p className="text-ink-700 mt-1 text-sm">
          Set up your basketball league. You can add divisions and teams later.
        </p>
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          League Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register("name")}
          type="text"
          id="name"
          className={inputClass}
          placeholder="Metro Youth Basketball League"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="season" className={labelClass}>
          Season <span className="text-red-500">*</span>
        </label>
        <input
          {...register("season")}
          type="text"
          id="season"
          className={inputClass}
          placeholder="Spring 2026"
        />
        {errors.season && <p className="mt-1 text-sm text-red-600">{errors.season.message}</p>}
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
          placeholder="Competitive youth basketball league for ages 8-18..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="flex gap-4">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back
        </button>
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Creating league..." : "Create League & Continue"}
        </button>
      </div>
    </form>
  )
}
