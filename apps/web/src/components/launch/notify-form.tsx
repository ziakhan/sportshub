"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { trackEvent } from "@/components/launch/launch-tracker"

/**
 * The launch notify ask (owner 2026-08-17), shared by the landing hero, the
 * targeted club band and the demo player's entry screen. One field takes an
 * email or a phone number; POST /api/launch/notify classifies and stores it.
 *
 * Never a gate: submitting is always optional, and once someone is on the
 * list (localStorage flag) the ask stops following them around.
 */

const DONE_KEY = "sh1-launch-notified"

const IDENTITIES = ["Player", "Parent", "Club", "League", "Referee", "Trainer", "Media"] as const

export function useAlreadyNotified(): boolean {
  const [done, setDone] = useState(false)
  useEffect(() => {
    try {
      setDone(window.localStorage.getItem(DONE_KEY) === "1")
    } catch {
      /* private mode: just show the ask */
    }
  }, [])
  return done
}

export function NotifyForm({
  source,
  identity,
  tone = "light",
  buttonClassName,
  buttonLabel = "Keep me posted",
  className,
  blocked = false,
  onBlocked,
  identityAfter = false,
  finePrint = false,
  clubNudgeHref,
}: {
  /** Recorded with the row: "landing" | "landing-claim" | "demo:<slug>" */
  source: string
  identity?: string
  /** "light" sits on white cards, "dark" sits on the navy hero. */
  tone?: "light" | "dark"
  buttonLabel?: string
  className?: string
  /** Replaces the tone-derived submit-button colours (the hero's white card
   *  wants gold on light, without changing every other light form). */
  buttonClassName?: string
  /** The hero requires an identity pick (owner 2026-08-17): when true,
   *  submit stops with a message and the caller highlights its picker. */
  blocked?: boolean
  onBlocked?: () => void
  /** Capture first, identify after (owner 2026-08-18): the form stays a slim
   *  field + button; the identity pills appear on the DONE card as a one-tap
   *  enrichment. A second POST with the same contact just updates the row. */
  identityAfter?: boolean
  /** CASL micro-line under the button: purpose + opt-out + privacy link. */
  finePrint?: boolean
  /** Where "find and claim it" points when someone picks Club after joining. */
  clubNudgeHref?: string
}) {
  const [contact, setContact] = useState("")
  const [picked, setPicked] = useState<string | null>(null)
  const [website, setWebsite] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === "sending") return
    if (blocked) {
      setError("Pick who you are first, then send.")
      setState("error")
      onBlocked?.()
      return
    }
    setState("sending")
    setError("")
    try {
      const res = await fetch("/api/launch/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, identity, source, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "That did not go through. Try again.")
        setState("error")
        return
      }
      setState("done")
      trackEvent("signup", window.location.pathname, {
        identity: identity || "none",
        source,
      })
      try {
        window.localStorage.setItem(DONE_KEY, "1")
      } catch {
        /* fine */
      }
    } catch {
      setError("That did not go through. Try again.")
      setState("error")
    }
  }

  const dark = tone === "dark"

  async function pickIdentity(id: string) {
    setPicked(id)
    try {
      await fetch("/api/launch/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, identity: id, source }),
      })
    } catch {
      /* quiet: the row already exists, identity is enrichment */
    }
  }

  if (state === "done") {
    if (identityAfter && !picked) {
      return (
        <div
          className={`rounded-xl px-4 py-3.5 ${
            dark ? "bg-white/10 text-white" : "bg-court-50 text-court-800 ring-1 ring-court-200"
          } ${className ?? ""}`}
        >
          <p className="text-[15px] font-semibold">
            You&apos;re on the list. One quick thing: which are you?
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {IDENTITIES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => void pickIdentity(id)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition-colors ${
                  dark
                    ? "bg-white/10 text-white/85 ring-1 ring-white/25 hover:bg-white/20"
                    : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div
        className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${
          dark ? "bg-white/10 text-white" : "bg-court-50 text-court-700 ring-1 ring-court-200"
        } ${className ?? ""}`}
      >
        You&apos;re on the list. We&apos;ll reach you when it opens.
        {picked === "Club" && clubNudgeHref && (
          <p className={`mt-1.5 text-[14px] font-normal ${dark ? "text-gold-100" : "text-ink-600"}`}>
            Run a club? It may already be listed.{" "}
            <a
              href={clubNudgeHref}
              className={`font-semibold underline underline-offset-2 ${dark ? "text-gold-400" : "text-gold-600"}`}
            >
              Find it and claim it
            </a>
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={className}>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="sr-only" htmlFor={`notify-${source}`}>
          Email or phone number
        </label>
        <input
          id={`notify-${source}`}
          type="text"
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com or (416) 555-0134"
          className={`min-w-0 flex-1 rounded-lg border-2 bg-white px-4 py-3 text-base text-ink-950 placeholder:text-ink-400 focus:outline-none ${
            dark
              ? "border-white/40 shadow-lg focus:border-gold-400"
              : "border-ink-300 focus:border-gold-500"
          }`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`cursor-pointer rounded-full px-6 py-3 text-base font-bold transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-60 ${
            buttonClassName ??
            (dark
              ? "bg-gold-500 text-ink-950 shadow-lg hover:bg-gold-400 focus-visible:ring-white"
              : "bg-ink-950 text-white hover:bg-ink-800 focus-visible:ring-gold-500")
          }`}
        >
          {state === "sending" ? "One moment" : buttonLabel}
        </button>
      </div>
      {error && (
        <p className={`mt-2 text-[14px] ${dark ? "text-gold-100" : "text-hoop-700"}`}>{error}</p>
      )}
      {finePrint && (
        <p className={`mt-2 text-[12.5px] ${dark ? "text-white/55" : "text-ink-400"}`}>
          Only launch news, nothing else. Unsubscribe anytime.{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </p>
      )}
    </form>
  )
}
