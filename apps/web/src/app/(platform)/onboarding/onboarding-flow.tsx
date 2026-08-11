"use client"

import { useEffect, useState } from "react"
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

// QA-209: every account already gets a generated default handle reserved at
// signup (settings-only until now, via /api/account/handle). This is a
// light, non-blocking step — Continue tries to save an edited handle but
// always moves on even if that fails or nothing changed, so onboarding never
// stalls on it.
const secondaryButtonClass =
  "rounded-xl border border-ink-200 bg-white px-4 py-2.5 font-semibold text-ink-700 transition hover:bg-court-50"
const primaryButtonClass =
  "flex-1 rounded-xl bg-play-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-play-700 disabled:cursor-not-allowed disabled:bg-ink-400"

/** K-007: the handle input embedded in the profile step (was its own step).
 *  Required as of 2026-08-11 (tester ruling) — amends QA-209's never-blocks
 *  rule; an empty or unavailable handle now stops submission with an error. */
function HandleField({
  draft,
  reserved,
  onChange,
}: {
  draft: string
  reserved: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-6">
      <label className="text-ink-700 block text-sm font-medium">
        Your handle <span className="text-red-500">*</span>{" "}
        <span className="text-ink-400 font-normal">(you can change it anytime)</span>
      </label>
      <div className="border-ink-200 focus-within:border-play-500 mt-1 flex w-full items-center rounded-xl border bg-white px-3 shadow-sm">
        <span className="text-ink-400 text-sm">@</span>
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="text-ink-900 w-full border-0 bg-transparent px-1 py-2.5 text-sm focus:outline-none focus:ring-0"
          placeholder="yourname"
          maxLength={20}
        />
      </div>
      <p className="text-ink-500 mt-1 text-xs">
        Your name across SportsHub{reserved ? ` — we reserved @${reserved} for you` : ""}. Leave it
        as is, or make it your own.
      </p>
    </div>
  )
}

// QA-209(b/c): Parent-role copy-only callouts surfaced during onboarding —
// no links, non-blocking, additive to the existing ParentForm.
function ParentInfoCallouts() {
  return (
    <div className="mb-6 space-y-3">
      <div className="border-ink-200 bg-court-50/60 rounded-xl border p-4 text-sm text-ink-700">
        Adding your kids next? You can also give a 13+ child their own login later from their
        profile page.
      </div>
      <div className="border-ink-200 bg-court-50/60 rounded-xl border p-4 text-sm text-ink-700">
        Player profiles are private by default. You approve who follows your kids.
      </div>
    </div>
  )
}

interface OnboardingFlowProps {
  userName: string
}

export function OnboardingFlow({ userName }: OnboardingFlowProps) {
  const [step, setStep] = useState<"role" | "profile" | "family">("role")
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [adultAttested, setAdultAttested] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // K-007: the handle is a FIELD on the profile step now, not its own step —
  // prefilled with the reserved default, saved non-blocking on submit.
  const [reservedHandle, setReservedHandle] = useState<string | null>(null)
  const [handleDraft, setHandleDraft] = useState("")
  useEffect(() => {
    fetch("/api/account/handle")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setReservedHandle(data?.handle ?? null)
        setHandleDraft(data?.handle ?? "")
      })
      .catch(() => {})
  }, [])
  // K-008: 13+ players get an optional invite-your-parent moment after their
  // profile saves (their Player record exists by then). Owner-rule note: the
  // event-driven-linking ruling — this is the player-initiated GUARDIAN
  // invite the API already supports, surfaced at onboarding.
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [pendingDest, setPendingDest] = useState<string>("/post-login")
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

  /** K-008: look up the just-created Player and send the GUARDIAN invite.
   *  Shared by the automatic post-save send and the recovery screen's retry. */
  const sendParentInvite = async (): Promise<boolean> => {
    setInviteBusy(true)
    setInviteError(null)
    try {
      const pr = await fetch("/api/players")
      const pd = await pr.json().catch(() => ({}))
      const playerId = pd?.players?.[0]?.id
      if (!playerId) {
        throw new Error(
          "Couldn't look up your player profile — you can invite them anytime from your profile page."
        )
      }
      const r = await fetch("/api/family-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GUARDIAN", playerId, email: inviteEmail.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "Couldn't send the invite")
      setInviteSent(true)
      return true
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Couldn't send the invite")
      return false
    } finally {
      setInviteBusy(false)
    }
  }

  const submitOnboarding = async (role: string, profileData?: ProfileData) => {
    setError(null)

    // K-007 (required handle): validate and save BEFORE creating the role —
    // an empty or taken handle blocks submission with a clear error.
    const trimmedHandle = handleDraft.trim().toLowerCase()
    if (!trimmedHandle) {
      setError("Pick a handle to continue — it's your name across SportsHub.")
      return
    }
    setIsSubmitting(true)
    if (trimmedHandle !== reservedHandle) {
      try {
        const hr = await fetch("/api/account/handle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: trimmedHandle }),
        })
        const hd = await hr.json().catch(() => ({}))
        if (!hr.ok) {
          setError(hd.error || "That handle isn't available — try another.")
          setIsSubmitting(false)
          return
        }
        setReservedHandle(trimmedHandle)
      } catch {
        setError("Network error saving your handle. Please try again.")
        setIsSubmitting(false)
        return
      }
    }

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
      const dest = callbackUrl ?? "/post-login"
      // K-008: the optional parent email collected on the profile step fires
      // now — the Player record exists as of this successful POST. Success
      // goes straight on; failure opens the recovery screen (retry/skip).
      if (role === "Player" && inviteEmail.trim()) {
        setPendingDest(dest)
        const sent = await sendParentInvite()
        if (!sent) {
          setIsSubmitting(false)
          setStep("family")
          return
        }
      }
      window.location.href = dest
    } catch {
      setError("Network error. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (step === "family") {
    return (
      <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        <div className="space-y-6">
          <div>
            <h2 className="text-ink-900 text-xl font-semibold">
              One last thing — invite your parent or guardian
              <span className="text-ink-400 font-normal"> (optional)</span>
            </h2>
            <p className="text-ink-700 mt-1 text-sm">
              They approve signups and handle payments for anything that costs money. We&apos;ll
              email them a link; you keep your own login either way.
            </p>
          </div>

          {inviteSent ? (
            <p className="text-court-700 border-court-200 bg-court-50/60 rounded-xl border p-4 text-sm font-semibold">
              Invite sent ✓ — they&apos;ll get an email with a link to connect to your account.
            </p>
          ) : (
            <div>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="parent@example.com"
                className="border-ink-200 focus:border-play-500 block w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:outline-none"
              />
              {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => (window.location.href = pendingDest)}
              className="text-ink-500 hover:text-ink-800 text-sm font-semibold"
            >
              {inviteSent ? "Continue" : "Skip for now"}
            </button>
            {!inviteSent && (
              <button
                type="button"
                disabled={inviteBusy || !inviteEmail.trim()}
                onClick={() => void sendParentInvite()}
                className={primaryButtonClass}
              >
                {inviteBusy ? "Sending…" : "Try again"}
              </button>
            )}
            {inviteSent && (
              <button
                type="button"
                onClick={() => (window.location.href = pendingDest)}
                className={primaryButtonClass}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step === "profile" && selectedRole) {
    return (
      <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-6 rounded-lg border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        <HandleField draft={handleDraft} reserved={reservedHandle} onChange={setHandleDraft} />

        {selectedRole === "Player" && (
          <div className="mb-6">
            <label className="text-ink-700 block text-sm font-medium">
              Parent or guardian&apos;s email{" "}
              <span className="text-ink-400 font-normal">(optional — we&apos;ll invite them)</span>
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="parent@example.com"
              className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:outline-none"
            />
            <p className="text-ink-500 mt-1 text-xs">
              They approve signups and handle payments for anything that costs money. Leave blank
              to do this later from your profile.
            </p>
          </div>
        )}

        {selectedRole === "Parent" && (
          <>
            <ParentInfoCallouts />
            <ParentForm
              onSubmit={handleProfileSubmit}
              onBack={() => setStep("role")}
              isSubmitting={isSubmitting}
            />
          </>
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

        <p className="text-ink-500 mt-4 text-center text-sm">Step 2 of 2: Complete your profile</p>
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

      <p className="text-ink-500 mt-4 text-center text-sm">Step 1 of 2: Choose your role</p>
    </div>
  )
}
