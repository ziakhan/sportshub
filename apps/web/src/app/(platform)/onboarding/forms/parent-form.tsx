"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { parentOnboardingSchema, type ParentOnboardingData } from "@/lib/validations/onboarding"
import { CountryStateSelector } from "@/components/country-state-selector"

interface ParentFormProps {
  onSubmit: (data: ParentOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
}

export function ParentForm({ onSubmit, onBack, isSubmitting }: ParentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ParentOnboardingData>({
    resolver: zodResolver(parentOnboardingSchema),
    defaultValues: { type: "Parent", country: "CA" },
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
        <h2 className="text-ink-900 text-xl font-semibold">Parent/Guardian Profile</h2>
        <p className="text-ink-700 mt-1 text-sm">
          Provide your contact details so clubs and coaches can reach you.
        </p>
      </div>

      <div>
        <label htmlFor="phoneNumber" className={labelClass}>
          Phone Number <span className="text-red-500">*</span>
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

      <CountryStateSelector
        countryValue={watch("country") || "CA"}
        stateValue={watch("state") || ""}
        onCountryChange={(country) => setValue("country", country)}
        onStateChange={(state) => setValue("state", state)}
        countryError={errors.country?.message}
        stateError={errors.state?.message}
      />

      <div>
        <label htmlFor="city" className={labelClass}>
          City <span className="text-red-500">*</span>
        </label>
        <input
          {...register("city")}
          type="text"
          id="city"
          className={inputClass}
          placeholder="Toronto"
        />
        {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
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
