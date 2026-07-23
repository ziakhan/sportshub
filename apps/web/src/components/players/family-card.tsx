"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Family linking card (family-accounts plan 2026-07-23), on the player edit
 * page next to the handle card:
 *  - Guardian of a 13+ kid without a login → "Give <kid> their own login"
 *    (email invite; the kid signs up and takes over the SAME profile;
 *    payments stay with the guardian).
 *  - Self-registered player (still their own guardian) → "Invite a
 *    parent/guardian" (parent accepts → becomes guardian AND payer).
 *  - Under-13 → explains why no login exists yet (COPPA).
 */

interface FamilyState {
  firstName: string
  isUnder13: boolean
  hasOwnLogin: boolean
  isSelfGuardian: boolean
  viewerIsGuardian: boolean
  viewerIsPlayer: boolean
  pendingInvite: { id: string; type: string; invitedEmail: string } | null
}

export function FamilyCard({ playerId }: { playerId: string }) {
  const [state, setState] = useState<FamilyState | null>(null)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/players/${playerId}/family`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setState)
      .catch(() => setState(null))
  }, [playerId])

  useEffect(() => {
    load()
  }, [load])

  if (!state) return null

  const inviteType: "CHILD_LOGIN" | "GUARDIAN" | null =
    state.viewerIsGuardian && !state.hasOwnLogin && !state.isUnder13
      ? "CHILD_LOGIN"
      : state.viewerIsPlayer && state.isSelfGuardian
        ? "GUARDIAN"
        : null

  async function send(type: "CHILD_LOGIN" | "GUARDIAN") {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/family-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, playerId, email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to send the invitation")
      setSent(true)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send the invitation")
    } finally {
      setBusy(false)
    }
  }

  const heading =
    inviteType === "GUARDIAN" ? "Invite a parent or guardian" : `Give ${state.firstName} their own login`

  return (
    <div className="border-ink-100 mt-4 rounded-2xl border bg-white p-5">
      <h2 className="text-ink-900 text-sm font-semibold">Family &amp; login</h2>

      {state.hasOwnLogin && !state.isSelfGuardian ? (
        <p className="text-ink-500 mt-2 text-sm">
          {state.firstName} has their own login, and payments stay with you. You both can manage
          this profile.
        </p>
      ) : state.isUnder13 && state.viewerIsGuardian ? (
        <p className="text-ink-500 mt-2 text-sm">
          {state.firstName} is under 13, so everything runs through your account for now. When
          they turn 13 you can give them their own login right here.
        </p>
      ) : state.pendingInvite ? (
        <p className="text-ink-500 mt-2 text-sm">
          Invitation sent to <strong>{state.pendingInvite.invitedEmail}</strong> — waiting for
          them to accept.
          {state.pendingInvite.type === "CHILD_LOGIN"
            ? ` Once accepted, ${state.firstName} signs in with their own account; registrations and payments stay with you.`
            : " Once accepted, they become the parent/guardian and payer for future programs."}
        </p>
      ) : inviteType ? (
        <>
          <p className="text-ink-500 mt-2 text-sm">
            {inviteType === "CHILD_LOGIN"
              ? `Send ${state.firstName} an invite to take over this profile with their own sign-in. They'll see their stats, teams, and schedule — payments and approvals stay with you.`
              : "Playing on your own account? Invite a parent or guardian: they approve followers and handle payments for your programs from their own login."}
          </p>
          {sent ? (
            <p className="text-court-700 mt-3 text-sm font-semibold">Invitation sent ✓</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={inviteType === "CHILD_LOGIN" ? `${state.firstName}'s email` : "Parent's email"}
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 block w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
              />
              <button
                type="button"
                onClick={() => send(inviteType)}
                disabled={busy || !email.includes("@")}
                className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 cursor-pointer whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 disabled:cursor-not-allowed"
              >
                {busy ? "Sending..." : heading}
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </>
      ) : null}
    </div>
  )
}
