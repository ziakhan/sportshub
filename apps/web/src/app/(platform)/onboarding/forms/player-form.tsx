"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  playerOnboardingSchema,
  type PlayerOnboardingData,
} from "@/lib/validations/onboarding"
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Player Profile
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Tell us a bit about yourself. You must be at least 13 years old.
        </p>
      </div>

      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <input
          {...register("dateOfBirth")}
          type="date"
          id="dateOfBirth"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.dateOfBirth && (
          <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
          Gender <span className="text-red-500">*</span>
        </label>
        <select
          {...register("gender")}
          id="gender"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select gender</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
        {errors.gender && (
          <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
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
        <label htmlFor="city" className="block text-sm font-medium text-gray-700">
          City <span className="text-red-500">*</span>
        </label>
        <input
          {...register("city")}
          type="text"
          id="city"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Toronto"
        />
        {errors.city && (
          <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="height" className="block text-sm font-medium text-gray-700">
            Height (Optional)
          </label>
          <input
            {...register("height")}
            type="text"
            id="height"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={`5'6"`}
          />
        </div>

        <div>
          <label htmlFor="jerseyNumber" className="block text-sm font-medium text-gray-700">
            Jersey Number (Optional)
          </label>
          <input
            {...register("jerseyNumber")}
            type="text"
            id="jerseyNumber"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="23"
          />
        </div>
      </div>

      <div>
        <label htmlFor="position" className="block text-sm font-medium text-gray-700">
          Preferred Position (Optional)
        </label>
        <select
          {...register("position")}
          id="position"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select position</option>
          <option value="Point Guard">Point Guard</option>
          <option value="Shooting Guard">Shooting Guard</option>
          <option value="Small Forward">Small Forward</option>
          <option value="Power Forward">Power Forward</option>
          <option value="Center">Center</option>
        </select>
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
          className="flex-1 rounded-md bg-yellow-500 px-4 py-3 font-semibold text-white shadow-sm hover:bg-yellow-600 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? "Setting up..." : "Complete Setup"}
        </button>
      </div>
    </form>
  )
}
