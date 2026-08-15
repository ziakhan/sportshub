import { notFound } from "next/navigation"
import { Work_Sans } from "next/font/google"

/**
 * DESIGN DECISION PAGE, not a product surface (2026-08-15).
 *
 * The app-wide body font (`--font-body` in layout.tsx) tops out at Work Sans
 * 700. Every `font-black` (CSS weight 900) used across the product is
 * therefore a browser-synthesized fake bold, not a real drawn cut. This page
 * loads a page-scoped heavier cut of Work Sans and puts three candidate
 * treatments of the same three hero samples side by side, so the choice can
 * be made by looking rather than by description.
 *
 * Dev-only twice over, same as /dev/control-kit: `/dev` is a DEV_ONLY_PREFIX
 * in lib/public-paths, so middleware blocks it live, and the page itself
 * refuses to render in production.
 */

// Page-scoped only. Nothing outside this file pays for this font file.
const workSansHeavy = Work_Sans({
  subsets: ["latin"],
  variable: "--font-heavy",
  weight: ["700", "800", "900"],
})

type Weight = "A" | "B" | "C"

const LABELS: Record<Weight, { name: string; note: string }> = {
  A: {
    name: "A: Current",
    note: "Today's stack, font-black (900) requested over a font file that only ships up to 700. The browser fakes the extra weight by smearing the 700 outline.",
  },
  B: {
    name: "B: True heavy",
    note: "Same 900 (and 800) but drawn from a Work Sans file that actually contains those cuts, loaded just for this page.",
  },
  C: {
    name: "C: Capped 700, sleek",
    note: "font-bold (700), a weight the site already loads everywhere, with tracking pulled in slightly to read taller without going heavier.",
  },
}

export default function TypeWeightsPreview() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="bg-ink-50/70 min-h-screen pb-20">
      <header className="border-ink-100 border-b bg-white px-4 py-10">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-ink-400 font-condensed text-[12px] font-black uppercase tracking-[0.2em]">
            Design decision
          </p>
          <h1 className="text-ink-950 mt-1 text-3xl font-black">Type weights</h1>
          <p className="text-ink-600 mt-2 max-w-2xl text-[14px] leading-6">
            Three treatments of the same three headline moments, so the call on how heavy our
            display type should be can be made in one glance instead of in a description.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {(Object.keys(LABELS) as Weight[]).map((key) => (
              <div key={key} className="border-ink-100 rounded-2xl border bg-white p-4">
                <p className="text-ink-950 text-[13.5px] font-black">{LABELS[key].name}</p>
                <p className="text-ink-500 mt-1 text-[12.5px] leading-5">{LABELS[key].note}</p>
              </div>
            ))}
          </div>
          <p className="text-ink-500 mt-4 max-w-2xl text-[12.5px] leading-5">
            A is a fake: the browser stretches a 700 outline to look like 900, and it can look
            slightly blurry up close. B is a real 800/900 cut, which costs one more font file on
            the pages that use it. C loads nothing new: it stays on the 700 the whole app already
            has and just tightens the letter spacing a touch. Sizes and colors are identical
            across all three columns on every sample below, only weight and tracking change.
          </p>
        </div>
      </header>

      <div className="mx-auto mt-10 w-full max-w-6xl space-y-10 px-4">
        <SampleRow title="Game score hero" why="Live and final score pages: the number people scan for first.">
          {(weight) => <ScoreHeroSample weight={weight} />}
        </SampleRow>

        <SampleRow
          title="Dashboard command hero"
          why="The navy band at the top of an operator's dashboard, first thing they see signed in."
        >
          {(weight) => <CommandHeroSample weight={weight} />}
        </SampleRow>

        <SampleRow
          title="Page band title"
          why="The daylight strip that titles browse pages such as Leagues, Scores and Clubs."
        >
          {(weight) => <PageBandSample weight={weight} />}
        </SampleRow>
      </div>
    </main>
  )
}

function SampleRow({
  title,
  why,
  children,
}: {
  title: string
  why: string
  children: (weight: Weight) => React.ReactNode
}) {
  return (
    <section className="border-ink-100 rounded-3xl border bg-white p-6 shadow-sm sm:p-7">
      <div className="mb-5">
        <h2 className="text-ink-950 text-[19px] font-black">{title}</h2>
        <p className="text-ink-500 mt-1.5 text-[13px] leading-5">{why}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {(["A", "B", "C"] as Weight[]).map((weight) => (
          <div key={weight}>
            <WeightChip weight={weight} />
            <div className="mt-2">{children(weight)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function WeightChip({ weight }: { weight: Weight }) {
  return (
    <span className="bg-play-50 text-play-700 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold">
      {LABELS[weight].name}
    </span>
  )
}

/** Weight + tracking for the large display type only. Size and color stay fixed. */
function displayStyle(weight: Weight): { className: string; style?: React.CSSProperties } {
  switch (weight) {
    case "A":
      return { className: "font-black" }
    case "B":
      return {
        className: `${workSansHeavy.variable} font-black`,
        style: { fontFamily: "var(--font-heavy)" },
      }
    case "C":
      return { className: "font-bold tracking-tight" }
  }
}

function ScoreHeroSample({ weight }: { weight: Weight }) {
  const display = displayStyle(weight)
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0b1628] p-5">
      <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
        Q4 · 0:00
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            Force Elite
          </p>
          <p
            className={`${display.className} mt-1 text-[42px] leading-none tabular-nums text-highlight`}
            style={display.style}
          >
            74
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/80">
          Final
        </span>
        <div className="min-w-0 text-right">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            Lords Basketball
          </p>
          <p
            className={`${display.className} mt-1 text-[42px] leading-none tabular-nums text-white/45`}
            style={display.style}
          >
            68
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] font-medium text-white/50">
        Six Park East · Saturday, Aug 15
      </p>
    </div>
  )
}

function CommandHeroSample({ weight }: { weight: Weight }) {
  const display = displayStyle(weight)
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0b1628] p-5">
      <p className="text-gold-400 text-[10.5px] font-black uppercase tracking-[0.2em]">
        Your season
      </p>
      <h3
        className={`${display.className} mt-2 text-[26px] leading-[1.05] text-white`}
        style={display.style}
      >
        Fall League 2026-27
      </h3>
      <p className="text-ink-200 mt-2 text-[13px] leading-5">
        Week 3 of 12. Two games this weekend, one still needs a referee.
      </p>
      <div className="mt-4 flex gap-6">
        <div>
          <p className={`${display.className} text-[22px] leading-none text-white`} style={display.style}>
            8
          </p>
          <p className="text-ink-300 mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
            Teams
          </p>
        </div>
        <div>
          <p className={`${display.className} text-[22px] leading-none text-white`} style={display.style}>
            24
          </p>
          <p className="text-ink-300 mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
            Games left
          </p>
        </div>
      </div>
    </div>
  )
}

function PageBandSample({ weight }: { weight: Weight }) {
  const display = displayStyle(weight)
  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border bg-[#faf3e3] p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b45309]">
        Browse
      </p>
      <h3
        className={`${display.className} text-ink-950 mt-1.5 text-[30px] leading-[1.04]`}
        style={display.style}
      >
        Leagues
      </h3>
      <p className="text-ink-600 mt-2 text-[13.5px] leading-5">
        Every league running near you, open registration first.
      </p>
    </div>
  )
}
