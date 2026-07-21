import Link from "next/link"
import { LEGAL } from "@/lib/legal"

export const metadata = {
  title: "Legal & Policies",
  description: "Privacy Policy, Terms of Service, and Acceptable Use Policy.",
}

const DOCS = [
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    blurb: "What information we collect, how we use it, how we protect children's data, and your rights.",
  },
  {
    href: "/legal/terms",
    title: "Terms of Service",
    blurb: "The agreement between you and us for using the platform, including accounts, payments, and liability.",
  },
  {
    href: "/legal/acceptable-use",
    title: "Acceptable Use Policy",
    blurb: "The conduct rules that keep the platform safe for families, players, and organizers.",
  },
]

export default function LegalIndexPage() {
  return (
    <div className="bg-ink-50 min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Legal &amp; Policies
        </h1>
        <p className="text-ink-500 mt-2 text-sm">Effective {LEGAL.effectiveDate}</p>
        <div className="mt-8 space-y-4">
          {DOCS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="border-ink-200 hover:border-play-300 block rounded-2xl border bg-white p-5 transition hover:shadow-sm"
            >
              <h2 className="text-ink-950 text-lg font-bold">{d.title}</h2>
              <p className="text-ink-600 mt-1 text-sm leading-6">{d.blurb}</p>
            </Link>
          ))}
        </div>
        <p className="text-ink-400 mt-8 text-xs leading-6">
          Questions about these policies? Contact us at {LEGAL.privacyEmail}.
        </p>
      </div>
    </div>
  )
}
