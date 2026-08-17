"use client"

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
  buttonLabel = "Keep me posted",
  className,
  blocked = false,
  onBlocked,
}: {
  /** Recorded with the row: "landing" | "landing-claim" | "demo:<slug>" */
  source: string
  identity?: string
  /** "light" sits on white cards, "dark" sits on the navy hero. */
  tone?: "light" | "dark"
  buttonLabel?: string
  className?: string
  /** The hero requires an identity pick (owner 2026-08-17): when true,
   *  submit stops with a message and the caller highlights its picker. */
  blocked?: boolean
  onBlocked?: () => void
}) {
  const [contact, setContact] = useState("")
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

  if (state === "done") {
    return (
      <p
        className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${
          dark ? "bg-white/10 text-white" : "bg-court-50 text-court-700 ring-1 ring-court-200"
        } ${className ?? ""}`}
      >
        You&apos;re on the list. We&apos;ll reach you when it opens.
      </p>
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
          className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 ${
            dark
              ? "border-0 bg-white text-ink-950 shadow-lg ring-1 ring-white/30 placeholder:text-ink-400 focus:ring-gold-400"
              : "border border-ink-200 bg-white text-ink-950 placeholder:text-ink-400 focus:border-gold-500/60 focus:ring-gold-500/30"
          }`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`cursor-pointer rounded-xl px-6 py-3 text-base font-bold transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-60 ${
            dark
              ? "bg-gold-500 text-ink-950 shadow-lg hover:bg-gold-400 focus-visible:ring-white"
              : "bg-ink-950 text-white hover:bg-ink-800 focus-visible:ring-gold-500"
          }`}
        >
          {state === "sending" ? "One moment" : buttonLabel}
        </button>
      </div>
      {error && (
        <p className={`mt-2 text-[14px] ${dark ? "text-gold-100" : "text-hoop-700"}`}>{error}</p>
      )}
    </form>
  )
}
