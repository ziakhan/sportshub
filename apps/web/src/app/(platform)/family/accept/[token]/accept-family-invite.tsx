"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type InviteType = "CHILD_LOGIN" | "GUARDIAN" | "CHILD_CLAIM"

/**
 * Accept/decline panel for a family invitation (client half of the page).
 *
 * Three shapes:
 *  - CHILD_LOGIN — a parent handed their 13+ kid a login for the profile the
 *    parent built.
 *  - GUARDIAN — a self-registered kid asked this account to be their parent.
 *    If this parent already has a row for the same child, the merge is
 *    offered right here (owner 2026-08-12: "I do like the idea of merging").
 *  - CHILD_CLAIM — the kid said a parent had already added them, and the
 *    server found the match. Approving attaches their login to the profile
 *    that already exists and absorbs their duplicate.
 */
export function AcceptFamilyInvite({
  token,
  type,
  playerName,
  playerFirstName,
  inviterName,
  invitedEmail,
  targetPlayerName,
  mergeCandidates,
}: {
  token: string
  type: InviteType
  playerName: string
  playerFirstName: string
  inviterName: string
  invitedEmail: string
  targetPlayerName: string | null
  mergeCandidates: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Default to merging when we found a match — one child, one profile is
  // what the family wants; keeping both is the deliberate choice.
  const [mergeId, setMergeId] = useState<string | null>(mergeCandidates[0]?.id ?? null)

  async function respond(action: "accept" | "decline") {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/family-invitations/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "accept" && type === "GUARDIAN" && mergeId
            ? { mergeIntoPlayerId: mergeId }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Something went wrong")
      if (action === "accept") {
        router.push(type === "CHILD_LOGIN" ? "/dashboard" : "/players")
      } else {
        router.push("/dashboard")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setBusy(null)
    }
  }

  const heading =
    type === "CHILD_LOGIN"
      ? `Take over ${playerName}'s profile`
      : type === "CHILD_CLAIM"
        ? `Link ${playerFirstName}'s login to their profile`
        : `Become ${playerName}'s parent or guardian`

  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-8">
      <h1 className="text-ink-900 text-xl font-bold">{heading}</h1>
      <p className="text-ink-600 mt-3 text-sm leading-relaxed">
        {type === "CHILD_LOGIN" ? (
          <>
            <strong>{inviterName}</strong> set up {playerName}&apos;s basketball profile and
            invited you to run it with your own login. You&apos;ll see your teams, games, stats,
            and schedule. Registrations and payments stay with {inviterName}.
          </>
        ) : type === "CHILD_CLAIM" ? (
          <>
            <strong>{playerName}</strong> made their own account and says you already set up a
            profile for them{targetPlayerName ? ` (${targetPlayerName})` : ""}. Approving joins
            the two: they sign in to the profile you built, their teams and history stay in one
            place, and you stay the guardian and the payer.
          </>
        ) : (
          <>
            <strong>{playerName}</strong> plays basketball on SportsHub and asked you to be
            their parent or guardian. Accepting links their profile to your account: you approve
            follower requests, register them for programs, and anything that costs money comes to
            you to approve and pay.
          </>
        )}
      </p>

      {type === "GUARDIAN" && mergeCandidates.length > 0 ? (
        <div className="border-play-100 bg-play-50/60 mt-5 rounded-2xl border p-4">
          <p className="text-ink-900 text-sm font-semibold">
            You already have {mergeCandidates.length === 1 ? "a profile" : "profiles"} for this
            child
          </p>
          <p className="text-ink-600 mt-1 text-sm">
            Join them into one so {playerFirstName} has a single profile with everything on it.
          </p>
          <div className="mt-3 space-y-2">
            {mergeCandidates.map((c) => (
              <label key={c.id} className="text-ink-700 flex items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="merge-target"
                  checked={mergeId === c.id}
                  onChange={() => setMergeId(c.id)}
                  className="border-ink-300 h-4 w-4"
                />
                <span>
                  Join into <strong>{c.name}</strong>
                </span>
              </label>
            ))}
            <label className="text-ink-700 flex items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="merge-target"
                checked={mergeId === null}
                onChange={() => setMergeId(null)}
                className="border-ink-300 h-4 w-4"
              />
              <span>Keep them as separate profiles</span>
            </label>
          </div>
        </div>
      ) : null}

      <p className="text-ink-400 mt-3 text-xs">Invitation sent to {invitedEmail}.</p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => respond("accept")}
          disabled={busy !== null}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 flex-1 cursor-pointer rounded-xl px-4 py-2.5 font-semibold text-white transition-colors duration-200"
        >
          {busy === "accept" ? "Linking..." : type === "CHILD_CLAIM" ? "Approve and link" : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => respond("decline")}
          disabled={busy !== null}
          className="border-ink-200 text-ink-600 hover:bg-ink-50 cursor-pointer rounded-xl border px-4 py-2.5 font-semibold transition-colors duration-200"
        >
          {busy === "decline" ? "..." : "Decline"}
        </button>
      </div>
    </div>
  )
}
