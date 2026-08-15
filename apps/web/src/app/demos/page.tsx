import Link from "next/link"
import { DEMOS } from "./registry"

/**
 * The bare /demos stage: nothing is selected yet, so the stage explains what
 * the console is and points at the rail. The chrome (search, filter, list)
 * lives in the layout, which is why this file is only the welcome card.
 */
export default function DemosWelcomePage() {
  const first = DEMOS.find((d) => d.status === "live")
  const stories = DEMOS.filter((d) => d.kind === "story").length
  const chapters = DEMOS.length - stories

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative isolate w-full max-w-2xl overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05] px-6 py-9 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] sm:px-10 sm:py-12">
        {/* Amber arc motif: the house mark, not decoration for its own sake. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border-[10px] border-gold-400/25"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-play-500/10 blur-3xl"
        />

        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400">
            See it work
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Pick a demo and watch it play
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/65">
            {stories} stories that follow one moment across the club side and the family
            phone, plus {chapters} chapters that stay on a single screen. Every walkthrough
            runs on the real product, and nothing here needs an account.
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              "Choose an audience on the left to see only what fits you.",
              "Stories play both sides at once, so you see the club and the parent.",
              "Press play, or step through it a beat at a time.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[13.5px] text-white/70">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400"
                />
                {line}
              </li>
            ))}
          </ul>

          {first && (
            <Link
              href={`/demos/${first.slug}`}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start with: {first.title}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
