"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  parentOnboardingSchema,
  type ParentOnboardingData,
} from "@/lib/validations/onboarding"
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Parent/Guardian Profile
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Provide your contact details so clubs and coaches can reach you.
        </p>
      </div>

      <div>
        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          {...register("phoneNumber")}
          type="tel"
          id="phoneNumber"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
        <label htmlFor="city" className="block text-sm font-medium text-gray-700">
          City <span className="text-red-500">*</span>
        </label>
        <input
          {...register("city")}
          type="text"
          id="city"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="Toronto"
        />
        {errors.city && (
          <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
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
          className="flex-1 rounded-md bg-orange-500 px-4 py-3 font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? "Setting up..." : "Complete Setup"}
        </button>
      </div>
    </form>
  )
}
