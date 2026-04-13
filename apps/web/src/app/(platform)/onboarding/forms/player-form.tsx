"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { playerOnboardingSchema, type PlayerOnboardingData } from "@/lib/validations/onboarding"
import { CountryStateSelector } from "@/components/country-state-selector"

interface PlayerFormProps {
  onSubmit: (data: PlayerOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
}

export function PlayerForm({ onSubmit, onBack, isSubmitting }: PlayerFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlayerOnboardingData>({
    resolver: zodResolver(playerOnboardingSchema),
    defaultValues: { type: "Player", country: "CA" },
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
        <h2 className="text-ink-900 text-xl font-semibold">Player Profile</h2>
        <p className="text-ink-700 mt-1 text-sm">
          Tell us a bit about yourself. You must be at least 13 years old.
        </p>
      </div>

      <div>
        <label htmlFor="dateOfBirth" className={labelClass}>
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <input {...register("dateOfBirth")} type="date" id="dateOfBirth" className={inputClass} />
        {errors.dateOfBirth && (
          <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="gender" className={labelClass}>
          Gender <span className="text-red-500">*</span>
        </label>
        <select {...register("gender")} id="gender" className={inputClass}>
          <option value="">Select gender</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
        {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="height" className={labelClass}>
            Height (Optional)
          </label>
          <input
            {...register("height")}
            type="text"
            id="height"
            className={inputClass}
            placeholder={`5'6"`}
          />
        </div>

        <div>
          <label htmlFor="jerseyNumber" className={labelClass}>
            Jersey Number (Optional)
          </label>
          <input
            {...register("jerseyNumber")}
            type="text"
            id="jerseyNumber"
            className={inputClass}
            placeholder="23"
          />
        </div>
      </div>

      <div>
        <label htmlFor="position" className={labelClass}>
          Preferred Position (Optional)
        </label>
        <select {...register("position")} id="position" className={inputClass}>
          <option value="">Select position</option>
          <option value="Point Guard">Point Guard</option>
          <option value="Shooting Guard">Shooting Guard</option>
          <option value="Small Forward">Small Forward</option>
          <option value="Power Forward">Power Forward</option>
          <option value="Center">Center</option>
        </select>
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
