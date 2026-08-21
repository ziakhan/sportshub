import { cn } from "@/components/ui/cn"

/**
 * Deck title-slide lockup, for approval before anything is wired.
 *
 * The deck at /deck/nph-... is ALREADY SENT, so registry.ts is deliberately
 * untouched. This page exists so the owner can see each option rendered at
 * the real size, in the real fonts, on the real ground, and pick one. Wiring
 * the winner is one line in registry.ts.
 *
 * Every class below is copied from the title slide's own lockup in
 * `_deck/league-deck.tsx` rather than approximated, so what is shown here is
 * what the slide will do.
 *
 * The asset is NPH's own white horizontal lockup, saved to
 * public/deck/logos/nph.svg from northpolehoops.com. It is 26 outlined paths
 * with no <text>, so it renders identically on every machine. We never re-set
 * their name in type: same rule we hold for our own mark.
 */

const EYEBROW = "font-mono uppercase tracking-[0.16em] text-white/60 text-[clamp(0.72rem,0.9vw,0.85rem)]"
const NAME = "font-display text-[clamp(1.05rem,1.7vw,1.5rem)] font-bold tracking-[-0.02em]"
const RULE = "flex w-fit flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/15 pt-6"

function Label({ children, note }: { children: string; note?: string }) {
  return (
    <div className="mb-4">
      <div className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-[#f24e1e]">{children}</div>
      {note ? <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-white/45">{note}</p> : null}
    </div>
  )
}

export default function DeckLockupPreview() {
  return (
    <div className="min-h-[100dvh] bg-[#0b1628] px-8 py-12 text-white sm:px-14">
      <div className="mx-auto max-w-[1100px]">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Deck title-slide lockup</h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-white/55">
          Nothing here is live. The deck still renders the name as plain text, exactly as it was
          sent. Pick an option and it becomes one line in <code className="text-white/80">registry.ts</code>.
        </p>

        <div className="mt-12 space-y-14">
          <section>
            <Label note="Their own asset, and nothing of ours added. Their logo already carries the name twice, as NPH and as the domain beneath it.">
              Option A · logo only
            </Label>
            <div className={RULE}>
              <span className={EYEBROW}>Prepared for</span>
              <img src="/deck/logos/nph.svg" alt="North Pole Hoops" className="h-9 w-auto object-contain sm:h-11" />
            </div>
          </section>

          <section>
            <Label note="What the code does today if a logo is supplied. The name then appears three times in one row: NPH, northpolehoops.com, and again as words.">
              Option B · logo and name
            </Label>
            <div className={RULE}>
              <span className={EYEBROW}>Prepared for</span>
              <img src="/deck/logos/nph.svg" alt="North Pole Hoops" className="h-9 w-auto object-contain sm:h-11" />
              <span className={NAME}>North Pole Hoops</span>
            </div>
          </section>

          <section>
            <Label note="What is live right now, and what he has already received. No logo, name set in our own display face.">
              Option C · name only, the current live state
            </Label>
            <div className={RULE}>
              <span className={EYEBROW}>Prepared for</span>
              <span className={NAME}>North Pole Hoops</span>
            </div>
          </section>

          <section>
            <Label note="Both are white on transparent and both are live on their site today. The difference is the subline: the 2025 file ends in .COM, which is a URL, and the 2021 file reads NORTHPOLEHOOPS, which is the name. On a slide that says Prepared for, the name reads better than the address. Raster versus vector does not matter here: the PNG is 1569px wide and is shown at about 120px.">
              Which file · 2021 vs 2025
            </Label>
            <div className="space-y-8">
              <div>
                <div className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-white/35">2021 PNG · subline NORTHPOLEHOOPS</div>
                <div className={RULE}>
                  <span className={EYEBROW}>Prepared for</span>
                  <img src="/deck/logos/nph-2021.png" alt="North Pole Hoops" className="h-9 w-auto object-contain sm:h-11" />
                </div>
              </div>
              <div>
                <div className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-white/35">2025 SVG · subline NORTHPOLEHOOPS.COM</div>
                <div className={RULE}>
                  <span className={EYEBROW}>Prepared for</span>
                  <img src="/deck/logos/nph.svg" alt="North Pole Hoops" className="h-9 w-auto object-contain sm:h-11" />
                </div>
              </div>
            </div>
          </section>

          <section>
            <Label note="Same lockup at three heights, so the scale can be judged rather than guessed. The slide currently uses h-9 on small screens and h-11 above.">
              Sizing · h-9, h-11, h-14
            </Label>
            <div className="space-y-7">
              {["h-9", "h-11", "h-14"].map((h) => (
                <div key={h} className={RULE}>
                  <span className={EYEBROW}>Prepared for</span>
                  <img src="/deck/logos/nph.svg" alt="North Pole Hoops" className={cn(h, "w-auto object-contain")} />
                  <span className="font-mono text-[0.7rem] tracking-[0.14em] text-white/30">{h}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <Label note="Their mark is white with one red. On a light ground the white disappears, so a light slide would need their dark variant. The deck's title slide is dark, so this is reference only.">
              On a light ground · reference
            </Label>
            <div className="w-fit rounded-xl bg-[#f4f6fa] px-7 py-6">
              <div className="flex w-fit flex-wrap items-center gap-x-5 gap-y-3 border-t border-black/15 pt-6">
                <span className="font-mono text-[0.8rem] uppercase tracking-[0.16em] text-black/50">Prepared for</span>
                <img src="/deck/logos/nph.svg" alt="North Pole Hoops" className="h-11 w-auto object-contain" />
              </div>
            </div>
          </section>

          <section>
            <Label note="Read off their live site rather than guessed. The page title and og:site_name both read North Pole Hoops, and every heading computes to Montserrat 700 uppercase. The joined, all-caps form only appears inside the logo, where it is the domain.">
              How they write it
            </Label>
            <dl className="grid max-w-[760px] gap-x-8 gap-y-3 text-sm sm:grid-cols-[220px_1fr]">
              {[
                ["In words", "North Pole Hoops"],
                ["Short form", "NPH"],
                ["Inside the logo", "NPH over NORTHPOLEHOOPS.COM"],
                ["Their red", "#EB2427"],
                ["Site font", "Montserrat. Headings 700 uppercase, body 400"],
                ["Logo type", "Outlined paths, no live text. Wider and squarer than Montserrat, so the logo is not set in it"],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-white/40">{k}</dt>
                  <dd className="text-white/85">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
