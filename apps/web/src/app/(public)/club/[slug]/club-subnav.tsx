"use client"

import { useEffect, useState } from "react"

export interface SubNavSection {
  anchor: string
  label: string
}

/**
 * Sticky section nav for the public club page. Highlights the section currently
 * in view (scroll-spy) in the club's brand color. Progressive enhancement: the
 * links are plain anchors, so it works with JS disabled — the active state is
 * the only thing that needs the observer.
 */
export function ClubSubNav({ sections }: { sections: SubNavSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.anchor ?? "")

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.anchor))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (inView[0]) setActive(inView[0].target.id)
      },
      // Trip the active section as its heading passes just under the sticky bar.
      { rootMargin: "-88px 0px -62% 0px", threshold: 0 }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav className="border-ink-100 sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
      <div className="container mx-auto flex gap-1 overflow-x-auto px-4 py-2 text-sm">
        {sections.map((s) => {
          const isActive = active === s.anchor
          return (
            <a
              key={s.anchor}
              href={`#${s.anchor}`}
              aria-current={isActive ? "true" : undefined}
              className={
                "brand-focus font-condensed relative cursor-pointer whitespace-nowrap rounded-lg px-3.5 py-2 text-[15px] font-semibold uppercase tracking-wide transition-colors " +
                (isActive
                  ? "text-[color:var(--brand-ink)]"
                  : "text-ink-500 hover:text-ink-950")
              }
            >
              {s.label}
              <span
                aria-hidden
                className={
                  "absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--brand)] transition-opacity " +
                  (isActive ? "opacity-100" : "opacity-0")
                }
              />
            </a>
          )
        })}
      </div>
    </nav>
  )
}
