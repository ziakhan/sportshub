"use client"

import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { playerOnboardingSchema, type PlayerOnboardingData } from "@/lib/validations/onboarding"
import { CountryStateSelector } from "@/components/country-state-selector"
import { ChipGroup, DateTimePicker } from "@/components/ui"

/**
 * The player step, compacted 2026-08-13 (owner: it ran off the bottom of the
 * screen). Every field the old form asked for is still here — the ruling was
 * "make it fit", not "ask for less". Two columns from the small breakpoint up,
 * chips instead of dropdowns for the short fixed lists, and the heading is
 * gone because the card's hero already says whose account this is.
 */

interface PlayerFormProps {
  onSubmit: (data: PlayerOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
  /** Slotted in before the buttons — the guardian block lives here. */
  afterFields?: ReactNode
  /** The guardian block runs its claim-check off the birth year. */
  onDateOfBirthChange?: (value: string) => void
  /** Hidden when the role came in from the demo or a role link. */
  showBack?: boolean
}

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
]

const POSITIONS = [
  { value: "Point Guard", label: "Point guard" },
  { value: "Shooting Guard", label: "Shooting guard" },
  { value: "Small Forward", label: "Small forward" },
  { value: "Power Forward", label: "Power forward" },
  { value: "Center", label: "Center" },
]

const labelClass = "block text-sm font-medium text-ink-800"
const inputClass =
  "border-ink-200 text-ink-900 placeholder-ink-400 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"
const errorClass = "mt-1 text-sm text-red-600"

export function PlayerForm({
  onSubmit,
  onBack,
  isSubmitting,
  afterFields,
  onDateOfBirthChange,
  showBack = true,
}: PlayerFormProps) {
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

  const thisYear = new Date().getFullYear()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="dateOfBirth" className={labelClass}>
            Date of birth <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <DateTimePicker
              id="dateOfBirth"
              mode="date"
              value={watch("dateOfBirth") || ""}
              onChange={(v) => {
                setValue("dateOfBirth", v, { shouldValidate: true })
                onDateOfBirthChange?.(v)
              }}
              placeholder="Pick your birthday"
              yearRange={[thisYear - 25, thisYear]}
            />
          </div>
          {errors.dateOfBirth && <p className={errorClass}>{errors.dateOfBirth.message}</p>}
        </div>

        <div>
          <span className={labelClass}>
            Gender <span className="text-red-500">*</span>
          </span>
          <ChipGroup
            ariaLabel="Gender"
            className="mt-1"
            value={watch("gender") || ""}
            onChange={(v) =>
              setValue("gender", v as PlayerOnboardingData["gender"], { shouldValidate: true })
            }
            options={GENDERS}
          />
          {errors.gender && <p className={errorClass}>{errors.gender.message}</p>}
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

        <div>
          <label htmlFor="height" className={labelClass}>
            Height <span className="text-ink-400 font-normal">optional</span>
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
            Jersey number <span className="text-ink-400 font-normal">optional</span>
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
        <span className={labelClass}>
          Position <span className="text-ink-400 font-normal">optional</span>
        </span>
        <ChipGroup
          ariaLabel="Preferred position"
          className="mt-1"
          allowClear
          value={watch("position") || ""}
          onChange={(v) => setValue("position", v)}
          options={POSITIONS}
        />
      </div>

      {afterFields}

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
