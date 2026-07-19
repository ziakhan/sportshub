"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Badge, Button } from "@/components/ui"

export function CompleteClaim({ token }: { token: string }) {
  const { data: session, status } = useSession()
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle")
  const [error, setError] = useState("")
  const [club, setClub] = useState<{ id: string; name: string } | null>(null)

  const complete = async () => {
    setState("working")
    setError("")
    try {
      const res = await fetch("/api/clubs/claim-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't complete the claim")
      setClub({ id: data.tenantId, name: data.tenantName })
      setState("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete the claim")
      setState("error")
    }
  }

  // Signed-in visitors redeem automatically — the link IS the intent.
  useEffect(() => {
    if (status === "authenticated" && token && state === "idle") complete()
  }, [status]) // eslint-disable-line

  if (!token) {
    return (
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8 text-center">
        <p className="text-ink-600 text-sm">This link is missing its token — check the email.</p>
      </div>
    )
  }

  const callbackUrl = encodeURIComponent(`/claim/complete?token=${token}`)

  return (
    <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8 text-center">
      <p className="text-ink-400 text-xs font-semibold uppercase tracking-wide">
        Take ownership
      </p>

      {status === "loading" || state === "working" ? (
        <p className="text-ink-500 mt-4 text-sm">Working…</p>
      ) : status === "unauthenticated" ? (
        <div className="mt-4 space-y-3">
          <p className="text-ink-600 text-sm">
            Your club is verified and reserved. Sign in or create an account — any email works —
            and the club binds to your account.
          </p>
          <Link
            href={`/sign-up?callbackUrl=${callbackUrl}`}
            className="bg-play-600 hover:bg-play-700 block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            Create an account
          </Link>
          <Link
            href={`/sign-in?callbackUrl=${callbackUrl}`}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 block w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
          >
            I already have an account
          </Link>
        </div>
      ) : state === "done" && club ? (
        <div className="mt-4 space-y-3">
          <Badge tone="success">Club claimed</Badge>
          <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase">
            {club.name}
          </h1>
          <p className="text-ink-600 text-sm">
            You&apos;re the owner — everything about the club is now yours to edit.
          </p>
          <Link
            href={`/clubs/${club.id}`}
            className="bg-play-600 hover:bg-play-700 block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            Go to your club dashboard
          </Link>
        </div>
      ) : state === "error" ? (
        <div className="mt-4 space-y-3">
          <p className="text-hoop-600 text-sm">{error}</p>
          <Button onClick={complete}>Try again</Button>
        </div>
      ) : (
        <p className="text-ink-500 mt-4 text-sm">Working…</p>
      )}
    </div>
  )
}
