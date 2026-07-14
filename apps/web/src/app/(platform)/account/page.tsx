import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getNavShape } from "@/lib/queries/nav-shape"
import { SignOutRow } from "./sign-out-row"

export const dynamic = "force-dynamic"

export const metadata = { title: "Account & settings" }

/**
 * /account — the filing cabinet (site-ia-plan §5.6.4): monthly-speed
 * admin for families. A hub of real pages (linkable), NEVER called a
 * dashboard. The mobile Account tab lands here.
 */
export default async function AccountPage() {
  const auth = await getSessionUserId()
  if (!auth) redirect("/sign-in?callbackUrl=/account")
  const shape = await getNavShape(auth.userId)

  const tiles: Array<{ href: string; title: string; detail: string; show: boolean }> = [
    { href: "/players", title: "My kids", detail: "Profiles, teams and stats", show: shape.hasKids },
    { href: "/payments", title: "Payments", detail: "History, receipts and amounts due", show: true },
    { href: "/offers", title: "Offers", detail: "Team offers received", show: shape.hasKids },
    { href: "/calendar", title: "Calendar & feeds", detail: "Full schedule, add to your phone", show: true },
    { href: "/notifications", title: "Notifications", detail: "What we've sent you", show: true },
    { href: "/settings/profile", title: "Profile & security", detail: "Name, email and password", show: true },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-ink-950 font-display text-2xl font-bold">Account &amp; settings</h1>
      <p className="text-ink-500 mt-1 text-sm">
        The occasional stuff — profiles, money, preferences. Day-to-day lives on{" "}
        <Link href="/" className="text-play-700 font-medium hover:underline">
          Home
        </Link>
        .
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {tiles
          .filter((t) => t.show)
          .map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="border-ink-100 hover:border-ink-200 rounded-2xl border bg-white p-4 transition hover:shadow-sm"
            >
              <p className="text-ink-950 text-sm font-semibold">{t.title}</p>
              <p className="text-ink-500 mt-0.5 text-xs">{t.detail}</p>
            </Link>
          ))}
      </div>

      <div className="border-ink-100 mt-6 overflow-hidden rounded-2xl border bg-white">
        <SignOutRow />
      </div>
    </div>
  )
}
