"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { refereeOnboardingSchema, type RefereeOnboardingData } from "@/lib/validations/onboarding"
import { ChipGroup } from "@/components/ui"

interface RefereeFormProps {
  onSubmit: (data: RefereeOnboardingData) => void
  onBack: () => void
  isSubmitting: boolean
  showBack?: boolean
}

const LEVELS = [
  { value: "Level 1", label: "Level 1 entry" },
  { value: "Level 2", label: "Level 2 intermediate" },
  { value: "Level 3", label: "Level 3 advanced" },
]

const labelClass = "block text-sm font-medium text-ink-800"
const inputClass =
  "border-ink-200 text-ink-900 placeholder-ink-400 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"
const errorClass = "mt-1 text-sm text-red-600"

export function RefereeForm({ onSubmit, onBack, isSubmitting, showBack = true }: RefereeFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RefereeOnboardingData>({
    resolver: zodResolver(refereeOnboardingSchema),
    defaultValues: { type: "Referee" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div>
        <span className={labelClass}>
          Certification level <span className="text-red-500">*</span>
        </span>
        <ChipGroup
          ariaLabel="Certification level"
          className="mt-1"
          value={watch("certificationLevel") || ""}
          onChange={(v) =>
            setValue("certificationLevel", v as RefereeOnboardingData["certificationLevel"], {
              shouldValidate: true,
            })
          }
          options={LEVELS}
        />
        {errors.certificationLevel && (
          <p className={errorClass}>{errors.certificationLevel.message}</p>
        )}
      </div>

      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="standardFee" className={labelClass}>
            Fee per game <span className="text-red-500">*</span>
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
          {errors.standardFee && <p className={errorClass}>{errors.standardFee.message}</p>}
        </div>

        <div>
          <label htmlFor="availableRegions" className={labelClass}>
            Regions you cover <span className="text-red-500">*</span>
          </label>
          <input
            {...register("availableRegions")}
            type="text"
            id="availableRegions"
            className={inputClass}
            placeholder="Toronto, Peel, York"
          />
          {errors.availableRegions ? (
            <p className={errorClass}>{errors.availableRegions.message}</p>
          ) : (
            <p className="text-ink-500 mt-1 text-xs">Separate them with commas.</p>
          )}
        </div>
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
