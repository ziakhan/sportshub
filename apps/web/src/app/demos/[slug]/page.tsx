import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AUDIENCE_LABELS, DEMOS, getDemo } from "../registry"
import { DemoRunner } from "../demo-runner"

export function generateStaticParams() {
  return DEMOS.map((d) => ({ slug: d.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const demo = getDemo(params.slug)
  if (!demo) return { title: "Demo" }
  return { title: demo.title, description: demo.promise }
}

/**
 * The stage half of the console: only the selected demo, letterboxed on the
 * ambient court. The rail, search and filter come from the layout, so nothing
 * here re-states the directory.
 */
export default function DemoStagePage({ params }: { params: { slug: string } }) {
  const demo = getDemo(params.slug)
  if (!demo) notFound()

  return (
    <div className="mx-auto w-full">
      <header className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-400">
          {demo.kind === "story" ? "Story" : "Chapter"}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-white/45">
          {demo.durationLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {demo.audiences.map((a) => (
            <span
              key={a}
              className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/70"
            >
              {AUDIENCE_LABELS[a]}
            </span>
          ))}
        </div>
        <div className="w-full">
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-[28px]">
            {demo.title}
          </h1>
          <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-white/60">
            {demo.promise}
          </p>
        </div>
      </header>

      {demo.status === "live" ? (
        // The player keeps its own light chrome (captions, chapter chips,
        // progress), so it sits on a lit panel rather than straight on navy.
        <div className="rounded-3xl border border-white/12 bg-[#f8f9fb] p-4 shadow-[0_50px_130px_-60px_rgba(0,0,0,0.95)] sm:p-6">
          <DemoRunner slug={demo.slug} />
        </div>
      ) : (
        <PromiseCard title={demo.title} promise={demo.promise} />
      )}
    </div>
  )
}

function PromiseCard({ title, promise }: { title: string; promise: string }) {
  const first = DEMOS.find((d) => d.status === "live")
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05] px-6 py-12 text-center sm:px-10 sm:py-16">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full border-[10px] border-gold-400/20"
      />
      <div className="relative mx-auto max-w-xl">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400">
          Being filmed
        </p>
        <h2 className="font-display mt-2 text-2xl font-extrabold leading-tight text-white">
          {title}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/65">{promise}</p>
        <p className="mt-4 text-[13px] leading-relaxed text-white/45">
          This walkthrough is scripted and on the build list.
        </p>
        {first && (
          <Link
            href={`/demos/${first.slug}`}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch: {first.title}
          </Link>
        )}
      </div>
    </div>
  )
}
