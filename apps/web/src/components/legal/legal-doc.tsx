import type { ReactNode } from "react"
import Link from "next/link"

/**
 * Shared shell for policy pages — branded prose container with a title,
 * effective date, and a small in-page section style. Kept simple + readable;
 * legal pages should be plain and scannable.
 */
export function LegalDoc({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate: string
  children: ReactNode
}) {
  return (
    <div className="bg-ink-50 min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/legal" className="text-play-700 hover:underline">
              &larr; Legal
            </Link>
          </div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            {title}
          </h1>
          <p className="text-ink-500 mt-2 text-sm">Effective {effectiveDate}</p>
        </div>
        <div className="legal-prose space-y-6 text-[15px] leading-7 text-ink-700">
          {children}
        </div>
      </div>
    </div>
  )
}

/** A numbered/anchored section within a policy. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-ink-950 text-lg font-bold">{heading}</h2>
      {children}
    </section>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

/** A policy block: string = paragraph, {list} = bullet list. All text stays in
 *  string literals so apostrophes never hit react/no-unescaped-entities. */
export type Block = string | { list: string[] }
export interface PolicySection {
  heading: string
  body: Block[]
}

export function PolicySections({ sections }: { sections: PolicySection[] }) {
  return (
    <>
      {sections.map((s) => (
        <Section key={s.heading} heading={s.heading}>
          {s.body.map((b, i) =>
            typeof b === "string" ? <P key={i}>{b}</P> : <List key={i} items={b.list} />
          )}
        </Section>
      ))}
    </>
  )
}
