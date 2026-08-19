import { notFound } from "next/navigation"

/**
 * DEV PREVIEW — Player of the Game, SQUARE round (owner brief 2026-08-19).
 *
 * Round three. The owner rejected both prior generations: Kai's rebuilt
 * trading card (too editorial for a keepsake) and the v2 trio (broadcast mug,
 * ticket, lower third — too poster). His anchor: the OLD SQUARE cards with
 * the big jersey number. So this round is four 1:1 compositions where the
 * NUMBER is the hero, deliberately unlike everything shown before.
 *
 * Direction sources, per the design law: ui-ux-pro-max consult (Y2K chrome,
 * Memphis playfulness, sticker collage for youth audiences) + 2026 sports
 * social trends (neon glow strokes, huge varsity type, dynamic badges).
 * Everything hand-authored DOM/SVG on product tokens; the few style hexes
 * that leave the token set are the point of the concept they appear in.
 *
 * SEPARATE ON PURPOSE (owner: "make sure they're separate, don't mix them
 * in") — its own route, not a section of Kai's /dev/feed-cards page.
 * Locked out of production the same way his page is.
 *
 * Sample data matches the other concept pages (Elijah Carter, #4, 24/11/5,
 * Lakeside 58-52 Northgate) so the choice stays about the template.
 */

export const metadata = {
  title: "POTG square concepts",
  robots: { index: false, follow: false },
}

const S = {
  name: "Elijah Carter",
  first: "ELIJAH",
  last: "CARTER",
  num: "4",
  team: "Lakeside Storm",
  opp: "Northgate Wolves",
  score: "58–52",
  pts: 24,
  reb: 11,
  ast: 5,
  league: "Maple Court · Grade 10",
  date: "Sat 8 Feb",
}

function Band({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-play-50 px-4 py-3 text-[14px] font-bold text-play-800 ring-1 ring-play-200">
      {children}
    </div>
  )
}

function ConceptShell({
  tag,
  title,
  blurb,
  children,
}: {
  tag: string
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-12">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-ink-950 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white">
          {tag}
        </span>
        <h2 className="font-display text-[22px] font-extrabold tracking-tight text-ink-950">
          {title}
        </h2>
      </div>
      <div className="mx-auto mt-4 aspect-square w-full max-w-[520px] overflow-hidden rounded-3xl shadow-soft ring-1 ring-ink-200">
        {children}
      </div>
      <p className="mx-auto mt-3 max-w-[520px] text-[14.5px] leading-relaxed text-ink-600">
        {blurb}
      </p>
    </section>
  )
}

/* ── S1 · Neon marquee ───────────────────────────────────────────────────── */

function NeonMarquee() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between bg-[#0a0a10] p-[6%]">
      {/* marquee dot border */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <rect
          x="3%"
          y="3%"
          width="94%"
          height="94%"
          rx="18"
          fill="none"
          stroke="#f59e0b55"
          strokeWidth="3"
          strokeDasharray="1 14"
          strokeLinecap="round"
        />
      </svg>
      <p className="whitespace-nowrap text-center text-[15px] font-bold uppercase tracking-[0.42em] text-gold-400">
        Player of the Game
      </p>
      {/* the number as a neon tube */}
      <svg viewBox="0 0 200 200" className="h-[52%] w-auto" aria-hidden="true">
        <text
          x="100"
          y="158"
          textAnchor="middle"
          fontSize="190"
          fontWeight="800"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="5"
          style={{ filter: "drop-shadow(0 0 14px #f59e0bcc) drop-shadow(0 0 34px #f59e0b66)" }}
        >
          {S.num}
        </text>
      </svg>
      <div className="text-center">
        <p className="font-condensed text-[9cqw] text-3xl font-bold uppercase leading-none tracking-wide text-white sm:text-4xl">
          {S.name}
        </p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
          {S.team} · {S.score}
        </p>
      </div>
      {/* scoreboard segments */}
      <div className="flex w-full items-stretch justify-center gap-2">
        {[
          [S.pts, "PTS"],
          [S.reb, "REB"],
          [S.ast, "AST"],
        ].map(([v, k]) => (
          <div
            key={k as string}
            className="flex-1 rounded-lg border border-gold-400/40 bg-gold-400/10 px-2 py-2 text-center"
          >
            <p className="font-condensed text-3xl font-bold leading-none text-gold-400 [text-shadow:0_0_10px_#f59e0b99]">
              {v}
            </p>
            <p className="mt-1 text-[11px] font-bold tracking-[0.3em] text-white/45">{k}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── S2 · Sticker drop ───────────────────────────────────────────────────── */

function StickerDrop() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f6f1e7]">
      {/* doodled court */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="14" fill="none" stroke="#c2410c" strokeWidth="0.8" />
        <path d="M0 50h36M64 50h36M28 0v22a22 22 0 0 0 44 0V0M28 100V78a22 22 0 0 1 44 0v22" fill="none" stroke="#c2410c" strokeWidth="0.8" />
      </svg>
      {/* arc headline */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <path id="arc" d="M 52 150 A 160 160 0 0 1 348 150" fill="none" />
        </defs>
        <text fontSize="25" fontWeight="800" fill="#b45309" letterSpacing="6">
          <textPath href="#arc" startOffset="50%" textAnchor="middle">
            PLAYER OF THE GAME
          </textPath>
        </text>
        {/* sparkle stars */}
        <g fill="#f59e0b">
          <path d="M60 60 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
          <path d="M340 76 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
          <path d="M320 320 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#e0443a" />
        </g>
      </svg>
      {/* the puffy number sticker */}
      <div className="absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg]">
        <div className="rounded-[28%] border-[10px] border-white bg-hoop-500 px-10 py-4 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
          <span className="font-display block text-[110px] font-black leading-none text-white [text-shadow:4px_4px_0_#b45309]">
            {S.num}
          </span>
        </div>
      </div>
      {/* torn tape stats */}
      <div className="absolute bottom-[16%] left-1/2 flex -translate-x-1/2 gap-2">
        {[
          [S.pts, "PTS", "rotate-[-4deg] bg-gold-400 text-ink-950"],
          [S.reb, "REB", "rotate-[3deg] bg-court-500 text-white"],
          [S.ast, "AST", "rotate-[-2deg] bg-play-600 text-white"],
        ].map(([v, k, cls]) => (
          <span
            key={k as string}
            className={`inline-block px-4 py-1.5 font-condensed text-2xl font-bold shadow-md [clip-path:polygon(2%_0,98%_4%,100%_96%,1%_100%)] ${cls}`}
          >
            {v} <span className="text-[12px] font-bold tracking-widest opacity-80">{k}</span>
          </span>
        ))}
      </div>
      {/* name on a label strip */}
      <div className="absolute bottom-[5%] left-1/2 w-[82%] -translate-x-1/2 rotate-[1.5deg] bg-ink-950 px-4 py-2 text-center shadow-md">
        <p className="font-condensed text-2xl font-bold uppercase tracking-[0.14em] text-white">
          {S.name} · {S.team}
        </p>
      </div>
    </div>
  )
}

/* ── S3 · Varsity pennant ────────────────────────────────────────────────── */

function VarsityPennant() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-court-800">
      {/* felt texture stripes */}
      <div className="absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(115deg,#fff_0px,#fff_2px,transparent_2px,transparent_9px)]" />
      {/* pennant sweeping the diagonal */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <polygon points="0,70 400,10 400,150" fill="#f6f1e7" stroke="#f59e0b" strokeWidth="6" />
        <polygon points="0,70 400,10 400,150" fill="none" stroke="#0f1b33" strokeWidth="2" strokeDasharray="7 6" transform="translate(0,6)" />
        <text x="215" y="88" textAnchor="middle" fontSize="24" fontWeight="900" fill="#0f1b33" letterSpacing="2" transform="rotate(-8 200 80)" textLength="290" lengthAdjust="spacingAndGlyphs">
          PLAYER OF THE GAME
        </text>
      </svg>
      {/* chenille number patch */}
      <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 220 240" className="h-[300px] w-auto" aria-hidden="true">
          <text x="110" y="200" textAnchor="middle" fontSize="230" fontWeight="900" fill="#f6f1e7" stroke="#f59e0b" strokeWidth="10" paintOrder="stroke" fontFamily="var(--font-display, inherit)">
            {S.num}
          </text>
          <text x="110" y="200" textAnchor="middle" fontSize="230" fontWeight="900" fill="none" stroke="#0f1b33" strokeWidth="2" strokeDasharray="4 5">
            {S.num}
          </text>
        </svg>
      </div>
      {/* circular patches for stats */}
      <div className="absolute bottom-[3%] left-1/2 z-10 flex -translate-x-1/2 gap-3">
        {[
          [S.pts, "POINTS"],
          [S.reb, "BOARDS"],
          [S.ast, "DIMES"],
        ].map(([v, k]) => (
          <div
            key={k as string}
            className="grid h-[92px] w-[92px] place-items-center rounded-full border-4 border-dashed border-gold-400 bg-[#f6f1e7] shadow-lg"
          >
            <div className="text-center">
              <p className="font-condensed text-3xl font-black leading-none text-court-800">{v}</p>
              <p className="text-[10px] font-black tracking-[0.18em] text-hoop-600">{k}</p>
            </div>
          </div>
        ))}
      </div>
      {/* name ribbon */}
      <div className="absolute left-0 top-[66%] w-full -rotate-2 bg-hoop-500 py-1.5 text-center shadow-md">
        <p className="font-condensed text-[26px] font-bold uppercase tracking-[0.2em] text-white">
          {S.first} <span className="text-gold-300">{S.last}</span> · {S.team}
        </p>
      </div>
    </div>
  )
}

/* ── S4 · Overprint press ────────────────────────────────────────────────── */

function OverprintPress() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f6f1e7]">
      {/* halftone field */}
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(#0f1b33_1.2px,transparent_1.4px)] [background-size:11px_11px]" />
      {/* the number, massive, cropped, misregistered overprint */}
      <div className="absolute -left-[8%] -top-[18%] select-none">
        <span className="font-display block text-[420px] font-black leading-none text-hoop-500 mix-blend-multiply">
          {S.num}
        </span>
      </div>
      <div className="absolute -left-[2%] -top-[11%] select-none">
        <span className="font-display block text-[420px] font-black leading-none text-court-600 opacity-60 mix-blend-multiply">
          {S.num}
        </span>
      </div>
      {/* vertical name rail */}
      <div className="absolute right-[5%] top-[5%] h-[58%] overflow-hidden [writing-mode:vertical-rl]">
        <p className="font-condensed text-4xl font-bold uppercase tracking-[0.24em] text-ink-950">
          {S.name}
        </p>
      </div>
      {/* gold seal */}
      <div className="absolute bottom-[16%] right-[6%] grid h-[110px] w-[110px] rotate-12 place-items-center rounded-full bg-gold-400 shadow-lg">
        <p className="px-3 text-center text-[13px] font-black uppercase leading-tight tracking-[0.14em] text-ink-950">
          Player of the Game
        </p>
      </div>
      {/* bottom ticker */}
      <div className="absolute bottom-0 left-0 w-full bg-ink-950 px-5 py-3">
        <p className="font-condensed flex items-baseline justify-between text-2xl font-bold uppercase tracking-wide text-white">
          <span>
            {S.pts} <span className="text-[13px] text-gold-400">PTS</span> · {S.reb}{" "}
            <span className="text-[13px] text-gold-400">REB</span> · {S.ast}{" "}
            <span className="text-[13px] text-gold-400">AST</span>
          </span>
          <span className="text-[15px] tracking-[0.16em] text-white/55">
            {S.team} {S.score}
          </span>
        </p>
      </div>
    </div>
  )
}

export default function PotgSquareConcepts() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-12">
      <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-hoop-600">
        Design preview · round 3
      </p>
      <h1 className="font-display mt-2 text-[30px] font-extrabold tracking-tight text-ink-950">
        Player of the Game, square
      </h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink-600">
        Four 1:1 concepts where the jersey number is the hero, none of them shaped
        like the earlier rounds. Same sample night on all four.
      </p>
      <div className="mt-4">
        <Band>Sample data — the demo set, safe to show anyone</Band>
      </div>

      <ConceptShell
        tag="S1"
        title="Neon marquee"
        blurb="The number as a lit neon tube on an arena-black square, stats as glowing scoreboard segments. Loud in a dark feed."
      >
        <NeonMarquee />
      </ConceptShell>

      <ConceptShell
        tag="S2"
        title="Sticker drop"
        blurb="A puffy die-cut number sticker slapped on doodled court paper, stats as torn tape. The playful one a kid would actually repost."
      >
        <StickerDrop />
      </ConceptShell>

      <ConceptShell
        tag="S3"
        title="Varsity pennant"
        blurb="Chenille-patch number and a felt pennant, stats as sewn-on circular patches. The keepsake that looks like a letterman jacket."
      >
        <VarsityPennant />
      </ConceptShell>

      <ConceptShell
        tag="S4"
        title="Overprint press"
        blurb="The number printed huge and cropped with a misregistered second pass, gold seal, ticker footer. The bold-poster one for older kids."
      >
        <OverprintPress />
      </ConceptShell>
    </main>
  )
}
