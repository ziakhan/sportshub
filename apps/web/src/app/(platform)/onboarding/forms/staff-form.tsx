"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { staffOnboardingSchema, type StaffOnboardingData } from "@/lib/validations/onboarding"
import { CountryStateSelector } from "@/components/country-state-selector"

interface StaffFormProps {
  onSubmit: (data: StaffOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
  showBack?: boolean
}

const labelClass = "block text-sm font-medium text-ink-800"
const inputClass =
  "border-ink-200 text-ink-900 placeholder-ink-400 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"
const errorClass = "mt-1 text-sm text-red-600"

export function StaffForm({ onSubmit, onBack, isSubmitting, showBack = true }: StaffFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StaffOnboardingData>({
    resolver: zodResolver(staffOnboardingSchema),
    defaultValues: { type: "Staff", country: "CA" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="phoneNumber" className={labelClass}>
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            {...register("phoneNumber")}
            type="tel"
            id="phoneNumber"
            autoComplete="tel"
            className={inputClass}
            placeholder="(555) 123-4567"
          />
          {errors.phoneNumber && <p className={errorClass}>{errors.phoneNumber.message}</p>}
        </div>

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
          {errors.city && <p className={errorClass}>{errors.city.message}</p>}
        </div>

        <CountryStateSelector
          layout="flat"
          countryValue={watch("country") || "CA"}
          stateValue={watch("state") || ""}
          onCountryChange={(country) => setValue("country", country)}
          onStateChange={(state) => setValue("state", state, { shouldValidate: true })}
          countryError={errors.country?.message}
          stateError={errors.state?.message}
        />
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
          {isSubmitting ? "Setting up..." : "Finish"}
        </button>
      </div>
    </form>
  )
}
