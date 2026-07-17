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
 *
 * Utility rows carry the brand-tinted icon tile (element-sweep ruling
 * 2026-07-17) — the same treatment the native Account tab uses, so the two
 * surfaces read identically.
 */

const STROKE = {
  users:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  card: "M1 4h22v16H1zM1 10h22",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
} as const

function TileIcon({ d }: { d: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
      style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  )
}

export default async function AccountPage() {
  const auth = await getSessionUserId()
  if (!auth) redirect("/sign-in?callbackUrl=/account")
  const shape = await getNavShape(auth.userId)

  const tiles: Array<{ href: string; title: string; detail: string; icon: string; show: boolean }> = [
    { href: "/players", title: "My kids", detail: "Profiles, teams and stats", icon: STROKE.users, show: shape.hasKids },
    { href: "/payments", title: "Payments", detail: "History, receipts and amounts due", icon: STROKE.card, show: true },
    { href: "/offers", title: "Offers", detail: "Team offers received", icon: STROKE.doc, show: shape.hasKids },
    { href: "/calendar", title: "Calendar & feeds", detail: "Full schedule, add to your phone", icon: STROKE.calendar, show: true },
    { href: "/notifications", title: "Notifications", detail: "What we've sent you", icon: STROKE.bell, show: true },
    { href: "/settings/profile", title: "Profile & security", detail: "Name, email and password", icon: STROKE.shield, show: true },
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
              className="border-ink-100 hover:border-ink-200 flex items-center gap-3 rounded-2xl border bg-white p-4 transition hover:shadow-sm"
            >
              <TileIcon d={t.icon} />
              <span className="min-w-0">
                <span className="text-ink-950 block text-[15px] font-semibold">{t.title}</span>
                <span className="text-ink-600 mt-0.5 block text-[13px]">{t.detail}</span>
              </span>
            </Link>
          ))}
      </div>

      <div className="border-ink-100 mt-6 overflow-hidden rounded-2xl border bg-white">
        <SignOutRow />
      </div>
    </div>
  )
}
