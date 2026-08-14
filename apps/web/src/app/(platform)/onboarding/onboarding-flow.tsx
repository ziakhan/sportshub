"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import type { ProfileData } from "@/lib/validations/onboarding"
import { BrandCheckbox } from "@/components/ui"
import { MergeOffer, type MergeCandidate } from "@/components/family/link-code"
import { ParentForm } from "./forms/parent-form"
import { PlayerForm } from "./forms/player-form"
import { StaffForm } from "./forms/staff-form"
import { RefereeForm } from "./forms/referee-form"
import { LeagueOwnerForm } from "./forms/league-owner-form"
import { GuardianBlock, EMPTY_GUARDIAN, type GuardianState } from "./guardian-block"

/**
 * Onboarding, rebuilt 2026-08-13 after the owner walked it.
 *
 * Four complaints, four answers:
 *  1. It asked the role again after the visitor had already picked one in the
 *     welcome pop-up. `initialRole` (from ?role=) now starts on the profile
 *     step with a quiet "Change" way back.
 *  2. The handle said "(optional)" while one was already reserved. It is a
 *     chip in the hero that shows what is theirs, with one word to change it.
 *  3. The guardian block was long and asked the kid a thing the server can
 *     answer. See guardian-block.tsx.
 *  4. A plain white card on a blank page, and the player form ran off the
 *     screen. Court-navy hero, two-column form, one viewport.
 *
 * The behaviour contracts underneath are unchanged: the handle never blocks
 * (QA-209), it saves before the role is created, operator roles attest 18+,
 * callbackUrl wins at the end, and a player's guardian invite only fires once
 * the profile POST has created the Player row.
 */

const ROLE_OPTIONS = [
  {
    id: "Parent",
    label: "parent",
    title: "Parent",
    description: "Your kids' teams, schedules and payments.",
    icon: "parent",
  },
  {
    id: "Player",
    label: "player",
    title: "Player",
    description: "Your team, your stats, your season. Ages 13 and up.",
    icon: "player",
  },
  {
    id: "Staff",
    label: "coach",
    title: "Coach or staff",
    description: "Roster, practices, RSVPs, game day.",
    icon: "staff",
  },
  {
    id: "ClubOwner",
    label: "club owner",
    title: "Club owner",
    description: "Teams, tryouts, offers and getting paid.",
    icon: "club",
  },
  {
    id: "LeagueOwner",
    label: "league operator",
    title: "League operator",
    description: "Schedule a season, standings, playoffs.",
    icon: "league",
  },
  {
    id: "Referee",
    label: "referee",
    title: "Referee",
    description: "Assignments, availability, scoresheets.",
    icon: "referee",
  },
  {
    id: "Trainer",
    label: "trainer",
    title: "Trainer",
    description: "Skills training, camps and bookings.",
    icon: "trainer",
  },
] as const

type RoleIconName = (typeof ROLE_OPTIONS)[number]["icon"]

function RoleIcon({ icon }: { icon: RoleIconName }) {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  }

  if (icon === "parent") {
    return (
      <svg {...shared}>
        <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M8 14c-3 0-5 1.5-5 4v1h10v-1c0-2.5-2-4-5-4Z" />
        <path d="M16 13c2.2 0 4 1.1 4 3v1h-4" />
      </svg>
    )
  }
  if (icon === "club") {
    return (
      <svg {...shared}>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v9.5h14V10" />
        <path d="M9.5 19.5V14h5v5.5" />
      </svg>
    )
  }
  if (icon === "staff") {
    return (
      <svg {...shared}>
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
        <path d="M9 3.5h6v3H9z" />
        <path d="M9 11h6M9 15h4" />
      </svg>
    )
  }
  if (icon === "referee") {
    return (
      <svg {...shared}>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
        <path d="M9 3.5v17M15 3.5v17" />
      </svg>
    )
  }
  if (icon === "player") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a14 14 0 0 1 0 17M12 3.5a14 14 0 0 0 0 17M3.5 12h17" />
      </svg>
    )
  }
  if (icon === "trainer") {
    return (
      <svg {...shared}>
        <path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" />
      </svg>
    )
  }
  return (
    <svg {...shared}>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" />
      <path d="M7.5 6H5a2.5 2.5 0 0 0 2.5 3M16.5 6H19a2.5 2.5 0 0 1-2.5 3" />
      <path d="M12 13.5V17M9 20h6" />
    </svg>
  )
}

// QA-106 ruling: operator roles (running clubs/leagues, officiating, training)
// require an 18+ attestation at onboarding. Parent/Player/Staff are unchanged.
const OPERATOR_ROLES = ["ClubOwner", "LeagueOwner", "Referee", "Trainer"]

const primaryButtonClass =
  "min-h-[44px] flex-1 cursor-pointer rounded-xl bg-play-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-play-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink-400"
const quietButtonClass =
  "min-h-[44px] cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-500 transition-colors duration-200 hover:text-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2"
const changeLinkClass =
  "cursor-pointer rounded text-[13px] font-semibold text-play-700 underline decoration-play-300 underline-offset-2 transition-colors duration-200 hover:text-play-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2"

/** The shaded ball the welcome pop-up uses, bleeding off the hero corner. */
function HeroBall() {
  return (
    <svg
      className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 opacity-[0.5] sm:h-48 sm:w-48"
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sh-ball-onboarding" cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="90" fill="url(#sh-ball-onboarding)" />
      <g fill="none" stroke="#7c2d12" strokeWidth="3.5" strokeLinecap="round" opacity="0.85">
        <path d="M100 10v180" />
        <path d="M10 100h180" />
        <path d="M42 31c36 34 36 104 0 138" />
        <path d="M158 31c-36 34-36 104 0 138" />
      </g>
      <ellipse cx="68" cy="58" rx="26" ry="17" fill="#fffbeb" opacity="0.22" transform="rotate(-28 68 58)" />
    </svg>
  )
}

/**
 * K-007 (owner 2026-08-12) plus the 2026-08-13 rebuild: the handle is not a
 * form field with an "(optional)" apology. Everyone already has one reserved
 * at signup, so the hero states it and offers one word to change it. QA-209
 * still governs the save: empty or unavailable keeps the reserved default and
 * onboarding carries on.
 */
function HandleChip({
  reserved,
  draft,
  loaded,
  editing,
  onDraftChange,
  onEditingChange,
}: {
  reserved: string | null
  draft: string
  loaded: boolean
  editing: boolean
  onDraftChange: (v: string) => void
  onEditingChange: (v: boolean) => void
}) {
  if (!loaded) {
    return (
      <span className="inline-flex min-h-[44px] items-center rounded-full bg-white/10 px-4 text-sm text-white/60">
        Reserving your name...
      </span>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-[44px] items-center rounded-full border border-amber-400/60 bg-white/10 px-3.5 transition-colors duration-200 focus-within:border-amber-300">
          <span className="text-[15px] font-black text-amber-300">@</span>
          <input
            id="handle"
            aria-label="Your handle"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value.toLowerCase())}
            maxLength={20}
            placeholder="yourname"
            className="w-44 bg-transparent px-1 py-2 text-[15px] font-bold text-white placeholder-white/40 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => onEditingChange(false)}
          className="min-h-[44px] cursor-pointer rounded-full px-3 text-[13px] font-bold text-white underline underline-offset-2 transition-colors duration-200 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <span className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-amber-500/15 px-4 py-1.5 ring-1 ring-inset ring-amber-400/40">
      <span className="text-[15px] font-black text-amber-200">@{draft || reserved}</span>
      <span className="font-condensed text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-100/80">
        yours
      </span>
      <span className="h-4 w-px bg-amber-300/35" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onEditingChange(true)}
        className="cursor-pointer rounded text-[13px] font-bold text-white underline underline-offset-2 transition-colors duration-200 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        change
      </button>
    </span>
  )
}

function Shell({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-[30px] bg-white shadow-[0_40px_110px_-45px_rgba(2,6,23,0.85)]">
      {hero}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

function Hero({
  stepLabel,
  greeting,
  subtitle,
  children,
}: {
  stepLabel: string
  greeting: ReactNode
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-5 pb-5 pt-5 text-white sm:px-7">
      <HeroBall />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p className="font-condensed text-[11.5px] font-bold uppercase tracking-[0.18em] text-amber-300">
          Set up your account
        </p>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {stepLabel}
        </p>
      </div>
      <h1 className="relative mt-2 text-[25px] font-black leading-tight sm:text-[28px]">
        {greeting}
      </h1>
      <p className="relative mt-1.5 max-w-md text-[14px] leading-6 text-white/80">{subtitle}</p>
      {children && <div className="relative mt-3">{children}</div>}
    </div>
  )
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {children}
    </div>
  )
}

/** What the terminal screen has to say once the profile is saved. */
type Outcome =
  | { kind: "invite-failed" }
  | { kind: "claim-sent" }
  | { kind: "linked"; playerId: string; mergeCandidate?: MergeCandidate }
  | { kind: "code-failed"; message: string }

interface OnboardingFlowProps {
  userName: string
  /** Pre-picked role from ?role= (validated server-side). */
  initialRole?: string | null
}

export function OnboardingFlow({ userName, initialRole = null }: OnboardingFlowProps) {
  const preset = initialRole && ROLE_OPTIONS.some((r) => r.id === initialRole) ? initialRole : null

  const [step, setStep] = useState<"role" | "profile" | "family">(preset ? "profile" : "role")
  const [selectedRole, setSelectedRole] = useState<string | null>(preset)
  const [adultAttested, setAdultAttested] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reservedHandle, setReservedHandle] = useState<string | null>(null)
  const [handleLoaded, setHandleLoaded] = useState(false)
  const [handleDraft, setHandleDraft] = useState("")
  const [handleEditing, setHandleEditing] = useState(false)
  // An unavailable handle is told once, then stops mattering — the next
  // Continue keeps the reserved default and moves on (QA-209 never-blocks).
  const [handleWarned, setHandleWarned] = useState(false)

  useEffect(() => {
    fetch("/api/account/handle")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setReservedHandle(data?.handle ?? null)
        setHandleDraft(data?.handle ?? "")
      })
      .catch(() => {})
      .finally(() => setHandleLoaded(true))
  }, [])

  // The guardian ask on the Player step. Everything it collects is spent
  // AFTER the profile POST, because the Player row has to exist first.
  const [guardian, setGuardian] = useState<GuardianState>(EMPTY_GUARDIAN)
  const [playerDob, setPlayerDob] = useState("")

  const [outcome, setOutcome] = useState<Outcome>({ kind: "invite-failed" })
  const [recoveryEmail, setRecoveryEmail] = useState("")
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

  const roleOption = ROLE_OPTIONS.find((r) => r.id === selectedRole) ?? null
  const firstName = userName || "there"

  const handleRoleContinue = () => {
    if (!selectedRole) {
      setError("Pick one to continue.")
      return
    }
    setError(null)
    setStep("profile")
  }

  const handleProfileSubmit = async (profileData: ProfileData) => {
    if (OPERATOR_ROLES.includes(selectedRole!) && !adultAttested) {
      setError("Confirm you are 18 or older to continue.")
      return
    }
    await submitOnboarding(selectedRole!, profileData)
  }

  const handleOperatorContinue = async () => {
    if (!adultAttested) {
      setError("Confirm you are 18 or older to continue.")
      return
    }
    await submitOnboarding(selectedRole!)
  }

  /** The Player row created by the profile POST. */
  async function ownPlayerId(): Promise<string | null> {
    try {
      const res = await fetch("/api/players")
      const data = await res.json().catch(() => ({}))
      return data?.players?.[0]?.id ?? null
    } catch {
      return null
    }
  }

  /** K-008: send the GUARDIAN invite. Shared with the recovery screen retry. */
  const sendParentInvite = async (email: string): Promise<boolean> => {
    setInviteBusy(true)
    setInviteError(null)
    try {
      const playerId = await ownPlayerId()
      if (!playerId) {
        throw new Error(
          "We couldn't find your player profile. You can invite them anytime from your profile page."
        )
      }
      const r = await fetch("/api/family-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GUARDIAN", playerId, email: email.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "We couldn't send that invite")
      setInviteSent(true)
      return true
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "We couldn't send that invite")
      return false
    } finally {
      setInviteBusy(false)
    }
  }

  /**
   * MATCH state: no email, no name, no address. The server already knows
   * which parent made the profile, so it resolves the target itself
   * (autoClaim). birthYear is the cross-check the API asks for.
   */
  async function sendAutoClaim(): Promise<boolean> {
    try {
      const playerId = await ownPlayerId()
      if (!playerId) return false
      const r = await fetch("/api/family-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "GUARDIAN",
          playerId,
          autoClaim: true,
          ...(guardian.birthYear ? { birthYear: guardian.birthYear } : {}),
        }),
      })
      return r.ok
    } catch {
      return false
    }
  }

  /** CODE state: redeem after the Player row exists, never before. */
  async function redeemGuardianCode(): Promise<Outcome> {
    try {
      const r = await fetch("/api/family/link-code/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guardian.code.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        return {
          kind: "code-failed",
          message: d.error || "That code did not work. Check it and try again.",
        }
      }
      const mine = await ownPlayerId()
      return {
        kind: "linked",
        playerId: d.playerId || mine || "",
        mergeCandidate: d.mergeCandidate,
      }
    } catch {
      return { kind: "code-failed", message: "That code did not work. Check it and try again." }
    }
  }

  const submitOnboarding = async (role: string, profileData?: ProfileData) => {
    setError(null)

    // K-007 as ruled 2026-08-12: save the handle BEFORE creating the role,
    // but never let it stop onboarding. Empty keeps the default reserved at
    // signup. A taken handle is said out loud once so the choice isn't
    // swallowed, and the next Continue goes through on the default.
    const trimmedHandle = handleDraft.trim().toLowerCase()
    setIsSubmitting(true)
    if (trimmedHandle && trimmedHandle !== reservedHandle && !handleWarned) {
      try {
        const hr = await fetch("/api/account/handle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: trimmedHandle }),
        })
        const hd = await hr.json().catch(() => ({}))
        if (!hr.ok) {
          setError(
            `${hd.error || "That handle isn't available."} Pick another, or press Finish again to keep ${reservedHandle ? `@${reservedHandle}` : "the one we reserved for you"}.`
          )
          setHandleWarned(true)
          setHandleEditing(true)
          setIsSubmitting(false)
          return
        }
        setReservedHandle(trimmedHandle)
      } catch {
        // Network trouble on a nice-to-have field is not a reason to trap
        // someone in onboarding: the reserved default is already theirs.
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

      // Every role finishes through /post-login, which runs the onboarding
      // soft gate (the /welcome checklist). A full reload lets the server
      // layouts pick up the fresh session/roles; an explicit deep-link
      // callbackUrl still wins.
      const dest = callbackUrl ?? "/post-login"
      setPendingDest(dest)

      // K-008: the guardian ask fires now — the Player record exists as of
      // this successful POST, and all three paths need it.
      if (role === "Player") {
        if (guardian.mode === "claim" && guardian.matched) {
          const ok = await sendAutoClaim()
          setIsSubmitting(false)
          setOutcome(ok ? { kind: "claim-sent" } : { kind: "invite-failed" })
          setStep("family")
          return
        }
        if (guardian.mode === "code" && guardian.code.trim()) {
          const result = await redeemGuardianCode()
          setIsSubmitting(false)
          setOutcome(result)
          setStep("family")
          return
        }
        if (guardian.mode === "email" && guardian.email.trim()) {
          const sent = await sendParentInvite(guardian.email)
          if (!sent) {
            setIsSubmitting(false)
            setRecoveryEmail(guardian.email)
            setOutcome({ kind: "invite-failed" })
            setStep("family")
            return
          }
        }
      }
      window.location.href = dest
    } catch {
      setError("Network error. Please try again.")
      setIsSubmitting(false)
    }
  }

  const goToDest = () => {
    window.location.href = pendingDest
  }

  // ---------------------------------------------------------------- terminal
  if (step === "family") {
    const done = outcome.kind === "claim-sent" || outcome.kind === "linked"
    return (
      <Shell
        hero={
          <Hero
            stepLabel="Almost there"
            greeting={
              done ? (
                <>
                  You&apos;re <span className="text-amber-400">in.</span>
                </>
              ) : (
                <>
                  One last <span className="text-amber-400">thing.</span>
                </>
              )
            }
            subtitle={
              done
                ? "Your account is ready. Here is what happens next."
                : "Your account is ready. This part is optional."
            }
          />
        }
      >
        {outcome.kind === "claim-sent" && (
          <div className="space-y-5">
            <p className="border-court-200 bg-court-50/70 text-court-800 rounded-xl border p-4 text-sm font-semibold">
              Done. Your parent will get a request to approve.
            </p>
            <button type="button" onClick={goToDest} className={`${primaryButtonClass} w-full`}>
              Continue
            </button>
          </div>
        )}

        {outcome.kind === "linked" && (
          <div className="space-y-5">
            <p className="border-court-200 bg-court-50/70 text-court-800 rounded-xl border p-4 text-sm font-semibold">
              Linked. Your parent can see your account now.
            </p>
            {outcome.mergeCandidate ? (
              <MergeOffer
                sourcePlayerId={outcome.playerId}
                candidate={outcome.mergeCandidate}
                onDone={goToDest}
              />
            ) : (
              <button type="button" onClick={goToDest} className={`${primaryButtonClass} w-full`}>
                Continue
              </button>
            )}
          </div>
        )}

        {(outcome.kind === "invite-failed" || outcome.kind === "code-failed") && (
          <div className="space-y-5">
            <p className="text-ink-700 text-sm leading-6">
              {outcome.kind === "code-failed"
                ? `${outcome.message} You can send them an email instead.`
                : "That email didn't go through. They approve payments and permissions, so it is worth another try."}
            </p>

            {inviteSent ? (
              <p className="border-court-200 bg-court-50/70 text-court-800 rounded-xl border p-4 text-sm font-semibold">
                Sent. They get an email with a link to connect to your account.
              </p>
            ) : (
              <div>
                <label htmlFor="recovery-email" className="text-ink-800 block text-sm font-medium">
                  Parent or guardian email
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="border-ink-200 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"
                />
                {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="button" onClick={goToDest} className={quietButtonClass}>
                {inviteSent ? "Continue" : "Skip for now"}
              </button>
              {!inviteSent && (
                <button
                  type="button"
                  disabled={inviteBusy || !recoveryEmail.trim()}
                  onClick={() => void sendParentInvite(recoveryEmail)}
                  className={primaryButtonClass}
                >
                  {inviteBusy ? "Sending..." : "Send it"}
                </button>
              )}
              {inviteSent && (
                <button type="button" onClick={goToDest} className={primaryButtonClass}>
                  Continue
                </button>
              )}
            </div>
          </div>
        )}
      </Shell>
    )
  }

  // ----------------------------------------------------------------- profile
  if (step === "profile" && selectedRole) {
    const isOperatorOnly = selectedRole === "ClubOwner" || selectedRole === "Trainer"
    const showBack = !preset

    return (
      <Shell
        hero={
          <Hero
            stepLabel={preset ? "Last step" : "Step 2 of 2"}
            greeting={
              <>
                Welcome, <span className="text-amber-400">{firstName}.</span>
              </>
            }
            subtitle={
              selectedRole === "Player"
                ? "A few details and your season page is live. You must be 13 or older."
                : "A few details and you are set up."
            }
          >
            <HandleChip
              reserved={reservedHandle}
              draft={handleDraft}
              loaded={handleLoaded}
              editing={handleEditing}
              onDraftChange={setHandleDraft}
              onEditingChange={setHandleEditing}
            />
          </Hero>
        }
      >
        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="border-play-100 bg-play-50 text-play-700 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-bold">
            <RoleIcon icon={roleOption?.icon ?? "player"} />
            {roleOption?.title}
          </span>
          {preset && (
            <button type="button" onClick={() => setStep("role")} className={changeLinkClass}>
              Not a {roleOption?.label}? Change
            </button>
          )}
        </div>

        {selectedRole === "Parent" && (
          <>
            <ParentForm
              onSubmit={handleProfileSubmit}
              onBack={() => setStep("role")}
              isSubmitting={isSubmitting}
              showBack={showBack}
            />
            <p className="text-ink-500 mt-4 text-[13px] leading-5">
              Player profiles are private by default, and you approve who follows your kids. You can
              give a 13+ child their own login later.
            </p>
          </>
        )}

        {selectedRole === "Player" && (
          <PlayerForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
            showBack={showBack}
            onDateOfBirthChange={setPlayerDob}
            afterFields={
              <GuardianBlock
                dateOfBirth={playerDob}
                state={guardian}
                onChange={setGuardian}
                onCheckResult={(matched, birthYear) =>
                  setGuardian((g) =>
                    g.matched === matched && g.birthYear === birthYear
                      ? g
                      : { ...g, matched, birthYear }
                  )
                }
              />
            }
          />
        )}

        {selectedRole === "Staff" && (
          <StaffForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
            showBack={showBack}
          />
        )}

        {selectedRole === "Referee" && (
          <div className="space-y-4">
            <BrandCheckbox
              checked={adultAttested}
              onChange={setAdultAttested}
              label="I am 18 years of age or older"
              subLabel="Running clubs and leagues, officiating and training are adult roles."
            />
            <RefereeForm
              onSubmit={handleProfileSubmit}
              onBack={() => setStep("role")}
              isSubmitting={isSubmitting}
              showBack={showBack}
            />
          </div>
        )}

        {selectedRole === "LeagueOwner" && (
          <div className="space-y-4">
            <BrandCheckbox
              checked={adultAttested}
              onChange={setAdultAttested}
              label="I am 18 years of age or older"
              subLabel="Running clubs and leagues, officiating and training are adult roles."
            />
            <LeagueOwnerForm
              onSubmit={handleProfileSubmit}
              onBack={() => setStep("role")}
              isSubmitting={isSubmitting}
              showBack={showBack}
            />
          </div>
        )}

        {isOperatorOnly && (
          <div className="space-y-4">
            <p className="text-ink-700 text-sm leading-6">
              {selectedRole === "ClubOwner"
                ? "One confirmation, then you can create your club."
                : "One confirmation, then you can set up your training."}
            </p>
            <BrandCheckbox
              checked={adultAttested}
              onChange={setAdultAttested}
              label="I am 18 years of age or older"
              subLabel="Running clubs and leagues, officiating and training are adult roles."
            />
            <div className="flex gap-3">
              {showBack && (
                <button
                  type="button"
                  onClick={() => setStep("role")}
                  className="border-ink-200 text-ink-700 hover:bg-court-50 min-h-[44px] cursor-pointer rounded-xl border bg-white px-4 py-2.5 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleOperatorContinue}
                disabled={isSubmitting || !adultAttested}
                className={primaryButtonClass}
              >
                {isSubmitting ? "Setting up..." : "Continue"}
              </button>
            </div>
          </div>
        )}
      </Shell>
    )
  }

  // -------------------------------------------------------------------- role
  return (
    <Shell
      hero={
        <Hero
          stepLabel="Step 1 of 2"
          greeting={
            <>
              Welcome, <span className="text-amber-400">{firstName}.</span>
            </>
          }
          subtitle="Pick what you do most. You can add more later, any time."
        >
          <HandleChip
            reserved={reservedHandle}
            draft={handleDraft}
            loaded={handleLoaded}
            editing={handleEditing}
            onDraftChange={setHandleDraft}
            onEditingChange={setHandleEditing}
          />
        </Hero>
      }
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      <div role="radiogroup" aria-label="Your role" className="grid gap-2.5 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const isSelected = selectedRole === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedRole(option.id)}
              className={`flex min-h-[44px] w-full cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-play-500 bg-play-50"
                  : "border-ink-200 hover:border-play-300 hover:bg-play-50/50 bg-white"
              }`}
            >
              <span
                className={`mt-1 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                  isSelected ? "border-play-500 bg-play-500" : "border-ink-300 bg-white"
                }`}
                aria-hidden="true"
              >
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
                  isSelected ? "text-play-700 bg-white" : "bg-court-50 text-ink-700"
                }`}
              >
                <RoleIcon icon={option.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block text-[15px] font-bold leading-5">
                  {option.title}
                </span>
                <span className="text-ink-600 mt-0.5 block text-[12.5px] leading-4">
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleRoleContinue}
        disabled={isSubmitting || !selectedRole}
        className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 mt-5 min-h-[44px] w-full cursor-pointer rounded-xl px-6 py-3.5 text-[16px] font-semibold text-white shadow-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </Shell>
  )
}
