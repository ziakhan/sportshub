"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"

/**
 * Sign-in / sign-up link that remembers WHERE the user was: the current
 * path+query rides along as callbackUrl so after auth (and onboarding, for
 * new accounts) they land back on the page they wanted, not the home page.
 */
function AuthLinkInner({
  to,
  className,
  children,
}: {
  to: "sign-in" | "sign-up"
  className?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams?.toString()
  const here = `${pathname ?? "/"}${query ? `?${query}` : ""}`
  const href =
    here && here !== "/" ? `/${to}?callbackUrl=${encodeURIComponent(here)}` : `/${to}`
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function AuthLink(props: {
  to: "sign-in" | "sign-up"
  className?: string
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<Link href={`/${props.to}`} className={props.className}>{props.children}</Link>}>
      <AuthLinkInner {...props} />
    </Suspense>
  )
}
