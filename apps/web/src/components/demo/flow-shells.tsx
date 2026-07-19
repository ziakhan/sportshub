"use client"

/**
 * v4 shells, built from scratch to the owner's spec (2026-07-19):
 * - PhoneShell: a FULL iPhone (bezel, notch, status bar, app chrome with
 *   bottom tabs) for every family-side step.
 * - DesktopShell: a near-full PC admin screen (browser chrome, app bar with
 *   the signed-in persona, workspace rail, page header) for operator steps.
 * - Duo: a true side-by-side that STAYS side by side on phones.
 * Content inside is the design system, functionally mirrored from the real
 * product screens. Demo data only.
 */

import type { ReactNode } from "react"

function BrandTile({ size = 20 }: { size?: number }) {
  return (
    <span
      className="relative flex items-center justify-center rounded-md bg-[#1e2d4d] font-black text-white"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      S
      <span
        className="bg-hoop-500 absolute flex items-center justify-center rounded-[2px] font-black"
        style={{ width: size * 0.42, height: size * 0.42, top: -size * 0.1, right: -size * 0.1, fontSize: size * 0.26 }}
      >
        1
      </span>
    </span>
  )
}

/* ---------------- iPhone ---------------- */

const TABS = [
  { label: "Home", d: "M3 10.5 12 3l9 7.5V21H3z" },
  { label: "Scores", d: "M13 2 3 14h9l-1 8 10-12h-9z" },
  { label: "Calendar", d: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4" },
  { label: "Chat", d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { label: "More", d: "M4 12h.01M12 12h.01M20 12h.01" },
]

export function PhoneShell({
  title,
  active = "Home",
  who,
  children,
}: {
  /** Screen title in the app bar area */
  title: string
  active?: string
  /** e.g. "Sam Lee" — shown on the avatar bubble */
  who: string
  children: ReactNode
}) {
  const initials = who
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[40px] border-[7px] border-[#101322] bg-[#101322] shadow-2xl">
      <div className="overflow-hidden rounded-[33px] bg-[#f5f6fa]">
        {/* status bar + notch */}
        <div className="relative bg-[#0b1628] px-5 pb-1.5 pt-2 text-white">
          <div className="absolute left-1/2 top-1.5 h-[18px] w-[92px] -translate-x-1/2 rounded-full bg-[#101322]" aria-hidden="true" />
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span>9:41</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <svg className="h-2.5 w-3.5" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
              <svg className="h-3 w-6" viewBox="0 0 26 12" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="21" height="11" rx="3"/><rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill="currentColor" stroke="none"/><path d="M23.5 4v4" strokeLinecap="round"/></svg>
            </span>
          </div>
          {/* app bar */}
          <div className="mt-1.5 flex items-center justify-between pb-1">
            <span className="flex items-center gap-1.5">
              <BrandTile size={22} />
              <span className="text-[13px] font-bold">SportsHub</span>
            </span>
            <span className="flex items-center gap-2.5">
              <svg className="h-[18px] w-[18px] text-white/85" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="bg-play-500 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black">{initials}</span>
            </span>
          </div>
        </div>
        {/* screen title */}
        <div className="border-ink-100 flex items-center justify-between border-b bg-white px-4 py-2.5">
          <span className="text-ink-950 text-[15px] font-extrabold tracking-tight">{title}</span>
        </div>
        {/* content */}
        <div className="min-h-[380px] px-3 py-3">{children}</div>
        {/* bottom tabs */}
        <div className="border-ink-100 flex items-center justify-around border-t bg-white px-1 pb-4 pt-1.5">
          {TABS.map((t) => (
            <span key={t.label} className={`flex flex-col items-center gap-0.5 px-1.5 ${t.label === active ? "text-hoop-600" : "text-ink-400"}`}>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.d} />
              </svg>
              <span className="text-[9px] font-bold">{t.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- PC ---------------- */

export function DesktopShell({
  url,
  who,
  nav,
  active,
  pageTitle,
  pageAction,
  children,
}: {
  url: string
  /** Signed-in persona, e.g. "Dana Whitfield · Ridgeview Rockets" */
  who: string
  nav: string[]
  active: string
  pageTitle: string
  pageAction?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border-ink-200 mx-auto w-full overflow-hidden rounded-xl border bg-white shadow-2xl">
      <div className="border-ink-100 flex items-center gap-2 border-b bg-[#eef0f6] px-3 py-1.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#fc5753]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#fdbc40]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#33c748]" />
        </span>
        <span className="border-ink-200 text-ink-500 mx-auto w-full max-w-[320px] truncate rounded-md border bg-white px-2.5 py-0.5 text-center text-[10.5px] font-medium">
          {url}
        </span>
      </div>
      <div className="border-ink-100 flex items-center justify-between border-b bg-white px-3.5 py-2">
        <span className="flex items-center gap-1.5">
          <BrandTile size={20} />
          <span className="text-ink-950 text-[12px] font-bold">SportsHub</span>
        </span>
        <span className="flex items-center gap-2">
          <svg className="text-ink-400 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="bg-play-50 text-play-700 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold">{who}</span>
        </span>
      </div>
      <div className="flex">
        <div className="border-ink-100 w-[92px] flex-none border-r bg-[#fafbfd] px-1.5 py-3 sm:w-[136px] sm:px-2">
          {nav.map((item) => (
            <div
              key={item}
              className={`mb-0.5 truncate rounded-lg px-2 py-1.5 text-[10.5px] font-semibold sm:text-[11.5px] ${
                item === active ? "bg-play-50 text-play-700" : "text-ink-500"
              }`}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="border-ink-50 flex items-center justify-between gap-2 border-b px-3.5 py-2.5 sm:px-5">
            <span className="text-ink-950 truncate text-[15px] font-extrabold tracking-tight sm:text-[17px]">{pageTitle}</span>
            {pageAction}
          </div>
          <div className="min-h-[360px] p-3 sm:p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- side by side ---------------- */

/** Two panes, one moment. Never stacks: the whole point is simultaneity. */
export function Duo({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: ReactNode
  right: ReactNode
  leftLabel: string
  rightLabel: string
}) {
  return (
    <div className="grid w-full grid-cols-2 items-start gap-2 sm:gap-5">
      <div className="min-w-0">
        <div className="text-ink-400 mb-1.5 truncate text-center text-[9.5px] font-black uppercase tracking-[0.12em] sm:text-[10.5px]">
          {leftLabel}
        </div>
        {left}
      </div>
      <div className="min-w-0">
        <div className="text-ink-400 mb-1.5 truncate text-center text-[9.5px] font-black uppercase tracking-[0.12em] sm:text-[10.5px]">
          {rightLabel}
        </div>
        {right}
      </div>
    </div>
  )
}
