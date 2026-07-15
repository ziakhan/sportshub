"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

/** Same-origin relative paths only. */
function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null
}

function MagicLinkLanding() {
  const searchParams = useSearchParams()
  const token = searchParams?.get("token") ?? ""
  const callbackUrl = safeCallbackUrl(searchParams?.get("callbackUrl")) ?? "/post-login"
  const [failed, setFailed] = useState(!token)
  const redeeming = useRef(false)

  useEffect(() => {
    if (!token || redeeming.current) return
    // Strict-mode double-mount guard: the token is single-use, so the second
    // effect run must not race the first and burn the grant.
    redeeming.current = true
    ;(async () => {
      try {
        const result = await signIn("magic", { token, redirect: false })
        if (result?.error) {
          setFailed(true)
        } else {
          // Full page reload to pick up session cookie in server layouts
          window.location.href = callbackUrl
        }
      } catch {
        setFailed(true)
      }
    })()
  }, [token, callbackUrl])

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="border-ink-100 shadow-panel w-full max-w-md rounded-[30px] border bg-white/95 p-8 text-center backdrop-blur-xl">
        {failed ? (
          <>
            <div className="border-gold-100 bg-gold-50 text-gold-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              Link expired
            </div>
            <h1 className="text-ink-950 mb-2 text-3xl font-bold">This link has expired</h1>
            <p className="text-ink-500 mb-6 text-sm">
              Sign-in links work once and expire after 15 minutes. Request a fresh one from the
              sign-in page — it only takes a moment.
            </p>
            <Link
              href="/sign-in"
              className="bg-ink-950 hover:bg-ink-800 inline-block w-full rounded-2xl px-4 py-3 font-semibold text-white transition"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              One moment
            </div>
            <h1 className="text-ink-950 mb-2 text-3xl font-bold">Signing you in…</h1>
            <p className="text-ink-500 text-sm">Checking your sign-in link.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function MagicLinkPage() {
  return (
    <Suspense>
      <MagicLinkLanding />
    </Suspense>
  )
}
