import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AUDIENCE_LABELS, DEMOS, getDemo } from "../registry"
import { CourtBackdrop } from "@/components/ui/court-backdrop"
import { SmartBack } from "@/components/ui/smart-back"
import { DemoRunner } from "./demo-runner"

export function generateStaticParams() {
  return DEMOS.map((d) => ({ slug: d.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const demo = getDemo(params.slug)
  if (!demo) return { title: "Demo" }
  return { title: demo.title, description: demo.promise }
}

export default function DemoPage({ params }: { params: { slug: string } }) {
  const demo = getDemo(params.slug)
  if (!demo) notFound()

  const live = demo.status === "live"

  return (
    <div className="bg-white">
      <CourtBackdrop
        variant="daylight"
        intensity="band"
        className="border-b border-[#e7dbc4]"
        contentClassName="container mx-auto px-4 py-6 sm:px-6 sm:py-8"
      >
        <SmartBack fallback="/demos" fallbackLabel="Demos" className="mb-3" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b45309]">
          {demo.kind === "story" ? "Story" : "Chapter"} - {demo.durationLabel}
        </p>
        <h1 className="text-ink-900 mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {demo.title}
        </h1>
        <p className="text-ink-600 mt-2 max-w-2xl text-sm leading-relaxed">{demo.promise}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {demo.audiences.map((a) => (
            <span
              key={a}
              className="text-ink-700 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-[#e7dbc4]"
            >
              {AUDIENCE_LABELS[a]}
            </span>
          ))}
        </div>
      </CourtBackdrop>

      <div className="container mx-auto px-4 py-7 sm:px-6 sm:py-9">
        {live ? (
          <DemoRunner slug={demo.slug} />
        ) : (
          <ComingSoon title={demo.title} />
        )}

        <div className="border-ink-100 mt-10 border-t pt-6">
          <p className="text-ink-500 text-sm font-medium">
            More walkthroughs are in the directory.
          </p>
          <Link
            href="/demos"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand,#1a73e8)]"
          >
            See all demos
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-3.5 w-3.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="border-ink-200 bg-ink-50/60 rounded-3xl border border-dashed px-6 py-14 text-center">
      <div className="bg-court-100 text-court-700 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <h2 className="text-ink-900 text-lg font-bold">{title} is being filmed</h2>
      <p className="text-ink-500 mx-auto mt-2 max-w-md text-sm leading-relaxed">
        This walkthrough is scripted and on the build list. The first one is ready to
        watch now.
      </p>
      <Link
        href="/demos/roster-story"
        className="mt-5 inline-flex items-center rounded-xl bg-[color:var(--brand,#1a73e8)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Watch: Build a team, fill the roster
      </Link>
    </div>
  )
}
