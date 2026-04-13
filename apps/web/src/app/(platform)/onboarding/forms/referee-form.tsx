"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { refereeOnboardingSchema, type RefereeOnboardingData } from "@/lib/validations/onboarding"

interface RefereeFormProps {
  onSubmit: (data: RefereeOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
}

export function RefereeForm({ onSubmit, onBack, isSubmitting }: RefereeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RefereeOnboardingData>({
    resolver: zodResolver(refereeOnboardingSchema),
    defaultValues: { type: "Referee" },
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
        <h2 className="text-ink-900 text-xl font-semibold">Referee Profile</h2>
        <p className="text-ink-700 mt-1 text-sm">
          Set up your referee profile so leagues and clubs can find and book you.
        </p>
      </div>

      <div>
        <label htmlFor="certificationLevel" className={labelClass}>
          Certification Level <span className="text-red-500">*</span>
        </label>
        <select {...register("certificationLevel")} id="certificationLevel" className={inputClass}>
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
        <label htmlFor="standardFee" className={labelClass}>
          Standard Fee per Game ($) <span className="text-red-500">*</span>
        </label>
        <input
          {...register("standardFee")}
          type="number"
          id="standardFee"
          min="0"
          step="0.01"
          className={inputClass}
          placeholder="50.00"
        />
        {errors.standardFee && (
          <p className="mt-1 text-sm text-red-600">{errors.standardFee.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="availableRegions" className={labelClass}>
          Available Regions <span className="text-red-500">*</span>
        </label>
        <input
          {...register("availableRegions")}
          type="text"
          id="availableRegions"
          className={inputClass}
          placeholder="California, Nevada, Arizona"
        />
        <p className="text-ink-500 mt-1 text-xs">Separate multiple regions with commas.</p>
        {errors.availableRegions && (
          <p className="mt-1 text-sm text-red-600">{errors.availableRegions.message}</p>
        )}
      </div>

      <div className="flex gap-4">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back
        </button>
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Setting up..." : "Complete Setup"}
        </button>
      </div>
    </form>
  )
}
