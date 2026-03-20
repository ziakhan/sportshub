"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  refereeOnboardingSchema,
  type RefereeOnboardingData,
} from "@/lib/validations/onboarding"

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          🏁 Referee Profile
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Set up your referee profile so leagues and clubs can find and book you.
        </p>
      </div>

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
          className="flex-1 rounded-md bg-orange-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? "Setting up..." : "Complete Setup"}
        </button>
      </div>
    </form>
  )
}
