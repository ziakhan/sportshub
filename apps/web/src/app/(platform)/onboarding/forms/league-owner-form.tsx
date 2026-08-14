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
  showBack?: boolean
}

const labelClass = "block text-sm font-medium text-ink-800"
const inputClass =
  "border-ink-200 text-ink-900 placeholder-ink-400 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"
const errorClass = "mt-1 text-sm text-red-600"

export function LeagueOwnerForm({
  onSubmit,
  onBack,
  isSubmitting,
  showBack = true,
}: LeagueOwnerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeagueOwnerOnboardingData>({
    resolver: zodResolver(leagueOwnerOnboardingSchema),
    defaultValues: { type: "LeagueOwner" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            League name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name")}
            type="text"
            id="name"
            className={inputClass}
            placeholder="Metro Youth Basketball League"
          />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
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
          {errors.season && <p className={errorClass}>{errors.season.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description <span className="text-ink-400 font-normal">optional</span>
        </label>
        <textarea
          {...register("description")}
          id="description"
          rows={2}
          className={inputClass}
          placeholder="Competitive youth basketball for ages 8 to 18"
        />
        {errors.description && <p className={errorClass}>{errors.description.message}</p>}
      </div>

      <div className="flex gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="border-ink-200 text-ink-700 hover:bg-court-50 min-h-[44px] cursor-pointer rounded-xl border bg-white px-4 py-2.5 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 min-h-[44px] flex-1 cursor-pointer rounded-xl px-4 py-3 font-semibold text-white shadow-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating league..." : "Create league"}
        </button>
      </div>
    </form>
  )
}
