import { notFound } from "next/navigation"
import { PlayerMug } from "@/components/ui"
import { PLAYER_ACCENTS, accentForKey } from "@/lib/ui/player-accent"

/**
 * DESIGN PROOF for PlayerMug v2, not a product surface (2026-08-15).
 *
 * Every size the app renders, every digit count, both surfaces, all eight
 * accent tones, so the template can be judged as a system instead of one tile
 * at a time. Dev-only twice over: `/dev` is a DEV_ONLY_PREFIX in
 * lib/public-paths, and the page refuses to render in production.
 */

const SIZES: { label: string; cls: string }[] = [
  { label: "20", cls: "h-5 w-5 rounded-full" },
  { label: "28", cls: "h-7 w-7 rounded-full" },
  { label: "36", cls: "h-9 w-9 rounded-full" },
  { label: "48", cls: "h-12 w-12 rounded-full" },
  { label: "64", cls: "h-16 w-16 rounded-2xl" },
  { label: "96", cls: "h-24 w-24 rounded-2xl" },
]

const NUMBERS: { label: string; value: string | null }[] = [
  { label: "none", value: null },
  { label: "7", value: "7" },
  { label: "23", value: "23" },
  { label: "100", value: "100" },
]

/** One demo key per tone, found by walking the hash so every tone is shown. */
const TONE_KEYS: string[] = (() => {
  const found = new Map<string, string>()
  for (let i = 0; i < 5000 && found.size < PLAYER_ACCENTS.length; i++) {
    const key = `player-${i}`
    const tone = accentForKey(key).name
    if (!found.has(tone)) found.set(tone, key)
  }
  return PLAYER_ACCENTS.map((a) => found.get(a.name) ?? a.name)
})()

const ROSTER = [
  "Ava Chen",
  "Malik Osei",
  "Jordan Reyes",
  "Sana Malik",
  "Elijah Cross",
  "Noah Abara",
  "Tyler Nguyen",
  "Grace Thompson",
]

export default function MugMatrixPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <div className="mx-auto max-w-6xl space-y-10 p-8">
      <header>
        <h1 className="font-display text-ink-950 text-2xl font-bold">PlayerMug v2 — size matrix</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Sizes 20 / 28 / 36 / 48 / 64 / 96 · numbers none / 7 / 23 / 100 · eight accents · light and dark.
          At 34px and below a numbered mug switches to the jersey crop.
        </p>
      </header>

      {/* ---------------- LIGHT: size × number, one tone per row block ------ */}
      <section className="space-y-6">
        <h2 className="text-ink-600 text-xs font-bold uppercase tracking-[0.18em]">
          Light — size × number
        </h2>
        {NUMBERS.map((n, ni) => (
          <div key={n.label} className="border-ink-100 rounded-2xl border bg-white p-4">
            <p className="text-ink-500 mb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
              number: {n.label}
            </p>
            <div className="flex flex-wrap items-end gap-6">
              {SIZES.map((s, si) => (
                <div key={s.label} className="flex flex-col items-center gap-2">
                  <PlayerMug
                    name={ROSTER[(ni + si) % ROSTER.length]}
                    accentKey={TONE_KEYS[(ni * 2 + si) % TONE_KEYS.length]}
                    jerseyNumber={n.value}
                    sizeClassName={s.cls}
                  />
                  <span className="text-ink-400 text-[10px] tabular-nums">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ---------------- LIGHT: all eight tones at every size -------------- */}
      <section className="border-ink-100 space-y-4 rounded-2xl border bg-white p-4">
        <h2 className="text-ink-600 text-xs font-bold uppercase tracking-[0.18em]">
          Light — eight accents, every size (number 23)
        </h2>
        <div className="space-y-3">
          {PLAYER_ACCENTS.map((a, i) => (
            <div key={a.name} className="flex items-end gap-5">
              <span className="text-ink-500 w-24 shrink-0 text-[11px] font-semibold">{a.name}</span>
              {SIZES.map((s) => (
                <PlayerMug
                  key={s.label}
                  name={ROSTER[i % ROSTER.length]}
                  accentKey={TONE_KEYS[i]}
                  jerseyNumber={23}
                  sizeClassName={s.cls}
                />
              ))}
              <span className="text-ink-400 font-mono text-[10px]">
                {a.deep} · {a.jersey} · {a.wash}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- LIGHT: a roster, which is the real test ----------- */}
      <section className="border-ink-100 rounded-2xl border bg-white p-4">
        <h2 className="text-ink-600 mb-3 text-xs font-bold uppercase tracking-[0.18em]">
          Light — a roster (32px crop, the row size) and 48px busts
        </h2>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {ROSTER.map((n, i) => (
            <div key={n} className="border-ink-100 flex items-center gap-3 border-b py-2 last:border-0">
              <PlayerMug
                name={n}
                accentKey={TONE_KEYS[i]}
                jerseyNumber={[4, 7, 11, 15, 23, 32, 44, 100][i]}
                sizeClassName="h-8 w-8 rounded-full"
              />
              <span className="text-ink-950 flex-1 truncate text-sm font-medium">{n}</span>
              <PlayerMug
                name={n}
                accentKey={TONE_KEYS[i]}
                jerseyNumber={[4, 7, 11, 15, 23, 32, 44, 100][i]}
                sizeClassName="h-12 w-12 rounded-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- DARK -------------------------------------------- */}
      <section className="space-y-6 rounded-2xl bg-navy-950 p-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
          Dark — size × number, then all eight accents
        </h2>
        {NUMBERS.map((n, ni) => (
          <div key={n.label} className="rounded-2xl bg-white/[0.03] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              number: {n.label}
            </p>
            <div className="flex flex-wrap items-end gap-6">
              {SIZES.map((s, si) => (
                <PlayerMug
                  key={s.label}
                  name={ROSTER[(ni + si) % ROSTER.length]}
                  accentKey={TONE_KEYS[(ni * 2 + si) % TONE_KEYS.length]}
                  jerseyNumber={n.value}
                  sizeClassName={s.cls}
                  surface="dark"
                />
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4">
          {PLAYER_ACCENTS.map((a, i) => (
            <div key={a.name} className="flex items-end gap-5">
              <span className="w-24 shrink-0 text-[11px] font-semibold text-white/60">{a.name}</span>
              {SIZES.map((s) => (
                <PlayerMug
                  key={s.label}
                  name={ROSTER[i % ROSTER.length]}
                  accentKey={TONE_KEYS[i]}
                  jerseyNumber={23}
                  sizeClassName={s.cls}
                  surface="dark"
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
