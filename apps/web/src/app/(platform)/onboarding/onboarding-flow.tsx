"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import type { ProfileData } from "@/lib/validations/onboarding"
import { ParentForm } from "./forms/parent-form"
import { PlayerForm } from "./forms/player-form"
import { StaffForm } from "./forms/staff-form"
import { RefereeForm } from "./forms/referee-form"
import { LeagueOwnerForm } from "./forms/league-owner-form"

const ROLE_OPTIONS = [
  {
    id: "Parent",
    title: "I'm a Parent",
    description: "Find tryouts and teams for my child. Track schedules, games, and stats.",
    icon: "parent",
  },
  {
    id: "ClubOwner",
    title: "I run a Club",
    description: "Create a basketball club, organize teams, run tryouts, and accept payments.",
    icon: "club",
  },
  {
    id: "Staff",
    title: "I'm a Staff Member",
    description: "Manage teams, rosters, practices, and game preparation.",
    icon: "staff",
  },
  {
    id: "Referee",
    title: "I'm a Referee",
    description: "Officiate youth basketball games, set availability, and track assignments.",
    icon: "referee",
  },
  {
    id: "Player",
    title: "I'm a Player (13+)",
    description:
      "View my team, schedule, games, and stats. Must be 13 or older to create an account.",
    icon: "player",
  },
  {
    id: "LeagueOwner",
    title: "I run a League",
    description:
      "Organize competitive basketball leagues with divisions, schedules, and standings.",
    icon: "league",
  },
  {
    id: "Trainer",
    title: "I'm a Trainer",
    description:
      "Run skills training, camps, group workouts, and 1-on-1 sessions families can book.",
    icon: "trainer",
  },
] as const

function RoleIcon({ icon }: { icon: (typeof ROLE_OPTIONS)[number]["icon"] }) {
  const iconClass = "h-5 w-5"

  if (icon === "parent") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M8 14c-3 0-5 1.5-5 4v1h10v-1c0-2.5-2-4-5-4Z" />
        <path d="M16 13c2.2 0 4 1.1 4 3v1h-4" />
      </svg>
    )
  }

  if (icon === "club") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v9h14v-9" />
        <path d="M9 19v-5h6v5" />
      </svg>
    )
  }

  if (icon === "staff") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    )
  }

  if (icon === "referee") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M12 3v18" />
        <path d="M8 3v18" />
        <path d="M16 3v18" />
      </svg>
    )
  }

  if (icon === "player") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a14 14 0 0 1 0 16" />
        <path d="M12 4a14 14 0 0 0 0 16" />
        <path d="M4 12h16" />
      </svg>
    )
  }

  if (icon === "trainer") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <path d="M6 7v10" />
        <path d="M18 7v10" />
        <path d="M3 9v6" />
        <path d="M21 9v6" />
        <path d="M6 12h12" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={iconClass}
    >
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.4l6.1-.9L12 3Z" />
    </svg>
  )
}

// QA-106 ruling: operator roles (running clubs/leagues, officiating, training)
// require an 18+ attestation at onboarding. Parent/Player/Staff are unchanged.
const OPERATOR_ROLES = ["ClubOwner", "LeagueOwner", "Referee", "Trainer"]

function AdultAttestationCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="border-ink-200 bg-court-50/60 flex items-start gap-2.5 rounded-xl border p-4 text-sm text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="border-ink-300 mt-0.5 h-4 w-4 rounded"
      />
      <span>
        I confirm I am 18 years of age or older
        <span className="text-ink-500 mt-0.5 block text-xs">
          Operator roles (running clubs, leagues, or officiating) are for adults.
        </span>
      </span>
    </label>
  )
}

interface OnboardingFlowProps {
  userName: string
}

export function OnboardingFlow({ userName }: OnboardingFlowProps) {
  const [step, setStep] = useState<"role" | "profile">("role")
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [adultAttested, setAdultAttested] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  // Deep link the user was chasing before sign-up — honored at the terminal
  // step so onboarding drops them where they meant to go, not on dashboard.
  const rawCallback = searchParams?.get("callbackUrl") ?? null
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : null

  const handleRoleContinue = async () => {
    if (!selectedRole) {
      setError("Please select a role to continue.")
      return
    }

    setError(null)

    // ClubOwner and Trainer have no per-role profile form — they still stop
    // at step 2, though, since operator roles need the 18+ attestation
    // before we hand them off to their create flow (/clubs/create,
    // /trainers/create).
    setStep("profile")
  }

  const handleProfileSubmit = async (profileData: ProfileData) => {
    if (OPERATOR_ROLES.includes(selectedRole!) && !adultAttested) {
      setError("Please confirm you are 18 years of age or older to continue.")
      return
    }
    await submitOnboarding(selectedRole!, profileData)
  }

  const handleOperatorContinue = async () => {
    if (!adultAttested) {
      setError("Please confirm you are 18 years of age or older to continue.")
      return
    }
    await submitOnboarding(selectedRole!)
  }

  const submitOnboarding = async (role: string, profileData?: ProfileData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: [role],
          profileData: profileData || undefined,
          adultAttested: OPERATOR_ROLES.includes(role) ? adultAttested : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
        setIsSubmitting(false)
        return
      }

      // Every role now finishes through /post-login, which runs the onboarding
      // soft gate (the /welcome checklist) — including club owners, whose first
      // checklist step is "Create your club". A full reload lets the server
      // layouts pick up the fresh session/roles; an explicit deep-link
      // callbackUrl still wins.
      window.location.href = callbackUrl ?? "/post-login"
    } catch {
      setError("Network error. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (step === "profile" && selectedRole) {
    return (
      <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-6 rounded-lg border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        {selectedRole === "Parent" && (
          <ParentForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "Player" && (
          <PlayerForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "Staff" && (
          <StaffForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "Referee" && (
          <>
            <AdultAttestationCheckbox checked={adultAttested} onChange={setAdultAttested} />
            <div className="mt-6">
              <RefereeForm
                onSubmit={handleProfileSubmit}
                onBack={() => setStep("role")}
                isSubmitting={isSubmitting}
              />
            </div>
          </>
        )}
        {selectedRole === "LeagueOwner" && (
          <>
            <AdultAttestationCheckbox checked={adultAttested} onChange={setAdultAttested} />
            <div className="mt-6">
              <LeagueOwnerForm
                onSubmit={handleProfileSubmit}
                onBack={() => setStep("role")}
                isSubmitting={isSubmitting}
              />
            </div>
          </>
        )}
        {(selectedRole === "ClubOwner" || selectedRole === "Trainer") && (
          <div className="space-y-6">
            <div>
              <h2 className="text-ink-900 text-xl font-semibold">
                {selectedRole === "ClubOwner" ? "Before you create your club" : "Before you set up training"}
              </h2>
              <p className="text-ink-700 mt-1 text-sm">One quick confirmation before we continue.</p>
            </div>
            <AdultAttestationCheckbox checked={adultAttested} onChange={setAdultAttested} />
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep("role")}
                className="border-ink-200 rounded-xl border bg-white px-4 py-2.5 font-semibold text-ink-700 transition hover:bg-court-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleOperatorContinue}
                disabled={isSubmitting || !adultAttested}
                className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-3 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Setting up..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        <p className="text-ink-500 mt-4 text-center text-sm">Step 2 of 2 — Complete your profile</p>
      </div>
    )
  }

  // Step 1: Role Selection
  return (
    <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
      <h1 className="text-ink-900 mb-2 text-3xl font-semibold">Welcome, {userName}!</h1>
      <p className="text-ink-700 mb-8">
        What best describes you? Pick your primary role to get started. You can take on more roles
        anytime — just add a child, create a club or league, or become a referee.
      </p>

      <div className="space-y-3">
        {ROLE_OPTIONS.map((option) => {
          const isSelected = selectedRole === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedRole(option.id)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition ${
                isSelected
                  ? "border-play-500 bg-play-50"
                  : "border-ink-100 hover:border-play-300 hover:bg-play-50/50 bg-white"
              }`}
            >
              {/* Radio circle */}
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isSelected ? "border-play-500 bg-play-500" : "border-ink-300 bg-white"
                }`}
              >
                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>

              {/* Icon */}
              <div
                className={`rounded-xl p-2 ${isSelected ? "text-play-700 bg-white" : "bg-court-50 text-ink-700"}`}
              >
                <RoleIcon icon={option.icon} />
              </div>

              {/* Text */}
              <div className="flex-1">
                <div className="text-ink-900 text-lg font-semibold">{option.title}</div>
                <div className="text-ink-700 mt-0.5 text-sm">{option.description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="border-hoop-200 text-hoop-700 mt-6 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleRoleContinue}
        disabled={isSubmitting || !selectedRole}
        className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 mt-8 w-full rounded-xl px-6 py-4 text-lg font-semibold text-white transition disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Setting up your account..." : "Continue"}
      </button>

      <p className="text-ink-500 mt-4 text-center text-sm">Step 1 of 2 — Choose your role</p>
    </div>
  )
}
