"use client"

import { useState } from "react"

export type CreativeKind = "static" | "spot" | "ad"

export interface CreativeEntry {
  /** File stem, e.g. "s7-teaser-moved". */
  name: string
  kind: CreativeKind
  /** Milliseconds, for animated creatives only. */
  durationMs?: number
  isNew?: boolean
}

/** Design sizes from _brand.css. The hash switches the creative's own engine. */
const FORMATS = {
  portrait: { w: 1080, h: 1350, hash: "#portrait", label: "Feed 4:5" },
  story: { w: 1080, h: 1920, hash: "#story", label: "Story / Reel 9:16" },
  square: { w: 1080, h: 1080, hash: "", label: "Square 1:1" },
} as const

type FormatKey = keyof typeof FORMATS

const KIND_LABEL: Record<CreativeKind, string> = {
  static: "Static",
  spot: "Animated spot",
  ad: "Full spot",
}

const KIND_TONE: Record<CreativeKind, string> = {
  static: "bg-white/10 text-white/70 ring-white/15",
  spot: "bg-play-500/20 text-play-200 ring-play-400/30",
  ad: "bg-hoop-500/20 text-hoop-200 ring-hoop-400/30",
}

/** Width each card renders the creative at; scale follows from the format. */
const CARD_W = 288

export function CreativeGallery({ creatives }: { creatives: CreativeEntry[] }) {
  const [format, setFormat] = useState<FormatKey>("portrait")
  /* Bumping a creative's nonce remounts its iframe, which is how an animated
     spot is replayed from the top without a page reload. */
  const [nonce, setNonce] = useState<Record<string, number>>({})

  const fmt = FORMATS[format]
  const scale = CARD_W / fmt.w

  return (
    <div className="min-h-screen bg-[#0b1628] text-white">
      <header className="border-b border-white/10 bg-[#0b1628]/95 px-6 py-5 backdrop-blur md:sticky md:top-0 md:z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold-400">
              Marketing
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Ad creatives</h1>
            <p className="mt-1 text-[13px] text-white/50">
              Live from scripts/marketing/creatives. {creatives.length} creatives.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10"
            role="tablist"
            aria-label="Format"
          >
            {(Object.keys(FORMATS) as FormatKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={format === key}
                onClick={() => setFormat(key)}
                className={`cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                  format === key
                    ? "bg-gold-500 text-ink-950"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {FORMATS[key].label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creatives.map((c) => {
            const src = `/dev/creatives/file/${c.name}.html${fmt.hash}`
            return (
              <figure key={c.name} className="min-w-0">
                <div
                  className="relative overflow-hidden rounded-xl bg-black ring-1 ring-white/15"
                  style={{ width: CARD_W, height: Math.round(fmt.h * scale) }}
                >
                  <iframe
                    key={`${c.name}-${format}-${nonce[c.name] ?? 0}`}
                    src={src}
                    title={c.name}
                    loading="lazy"
                    scrolling="no"
                    className="absolute left-0 top-0 origin-top-left border-0"
                    style={{ width: fmt.w, height: fmt.h, transform: `scale(${scale})` }}
                  />
                </div>

                <figcaption className="mt-3 w-[288px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${KIND_TONE[c.kind]}`}
                    >
                      {KIND_LABEL[c.kind]}
                    </span>
                    {c.durationMs ? (
                      <span className="text-[12px] font-semibold text-white/45">
                        {(c.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                    {c.isNew ? (
                      <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-950">
                        New
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 truncate text-[15px] font-semibold">{c.name}</p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold">
                    {/* The postable file. Rendered on demand at full export
                        size (PNG for statics, MP4 for spots), so what lands in
                        Downloads is what the CLI would have produced. */}
                    <a
                      href={`/dev/creatives/download/${c.name}/${format}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-gold-500 px-2.5 py-1 text-ink-950 transition-colors hover:bg-gold-400"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3.5 w-3.5">
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Download {FORMATS[format].w}&times;{FORMATS[format].h}
                    </a>
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer text-white/55 transition-colors hover:text-white"
                    >
                      Open full size
                    </a>
                    {c.kind !== "static" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setNonce((n) => ({ ...n, [c.name]: (n[c.name] ?? 0) + 1 }))
                        }
                        className="cursor-pointer text-white/50 transition-colors hover:text-white"
                      >
                        Replay
                      </button>
                    ) : null}
                  </div>
                </figcaption>
              </figure>
            )
          })}
        </div>

        <p className="mt-10 rounded-xl bg-white/5 p-4 text-[13px] leading-relaxed text-white/50 ring-1 ring-white/10">
          These are the authored sources, playing live. <b className="text-white/80">Download</b> renders
          the postable file at full export size for the format selected above: PNG for statics,
          MP4 for the animated spots. The first click on a creative costs a render, the rest are
          instant. To export everything at once instead:
          <code className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-white/70">
            node scripts/marketing/render-creatives.mjs &lt;outDir&gt;
          </code>
        </p>
      </main>
    </div>
  )
}
