"use client"

import { useMemo, useState } from "react"

export type CreativeKind = "static" | "spot" | "ad"
export type Audience = "everyone" | "clubs" | "leagues" | "players" | "parents" | "coaches"

export interface CreativeEntry {
  /** File stem, e.g. "s7-teaser-moved". */
  name: string
  kind: CreativeKind
  /** Milliseconds, for animated creatives only. */
  durationMs?: number
  audience: Audience
  /** The matching static or video of the same idea, if there is one. */
  twin?: string
  isNew?: boolean
}

/** Design sizes from _brand.css. The hash switches the creative's own engine. */
const FORMATS = {
  portrait: { w: 1080, h: 1350, hash: "#portrait", label: "Feed 4:5" },
  story: { w: 1080, h: 1920, hash: "#story", label: "Story / Reel 9:16" },
  square: { w: 1080, h: 1080, hash: "", label: "Square 1:1" },
} as const

type FormatKey = keyof typeof FORMATS
type KindFilter = "all" | CreativeKind
type AudienceFilter = "all" | Audience

const KIND_LABEL: Record<CreativeKind, string> = {
  static: "Image",
  spot: "Video",
  ad: "Full spot",
}

const KIND_TONE: Record<CreativeKind, string> = {
  static: "bg-white/10 text-white/75 ring-white/20",
  spot: "bg-play-600/30 text-play-200 ring-play-400/40",
  ad: "bg-hoop-500/25 text-[#ffb27f] ring-hoop-500/40",
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  everyone: "Everyone",
  clubs: "Clubs",
  leagues: "Leagues",
  players: "Players",
  parents: "Parents",
  coaches: "Coaches",
}

/** Width each card renders the creative at; scale follows from the format. */
const CARD_W = 288

export function CreativeGallery({ creatives }: { creatives: CreativeEntry[] }) {
  const [format, setFormat] = useState<FormatKey>("portrait")
  const [kind, setKind] = useState<KindFilter>("all")
  const [audience, setAudience] = useState<AudienceFilter>("all")
  /* Bumping a creative's nonce remounts its iframe, which is how a video is
     replayed from the top without a page reload. */
  const [nonce, setNonce] = useState<Record<string, number>>({})

  const fmt = FORMATS[format]
  const scale = CARD_W / fmt.w

  const shown = useMemo(
    () =>
      creatives.filter(
        (c) => (kind === "all" || c.kind === kind) && (audience === "all" || c.audience === audience)
      ),
    [creatives, kind, audience]
  )

  /* Counts live on the filter chips so an empty result is never a surprise. */
  const kindCount = (k: KindFilter) =>
    creatives.filter(
      (c) => (k === "all" || c.kind === k) && (audience === "all" || c.audience === audience)
    ).length
  const audienceCount = (a: AudienceFilter) =>
    creatives.filter((c) => (a === "all" || c.audience === a) && (kind === "all" || c.kind === kind))
      .length

  const audiences: AudienceFilter[] = [
    "all",
    "everyone",
    "clubs",
    "leagues",
    "players",
    "parents",
    "coaches",
  ]

  return (
    <div className="min-h-screen bg-[#0b1628] text-white">
      <header className="border-b border-white/10 bg-[#0b1628]/95 px-6 py-5 backdrop-blur md:sticky md:top-0 md:z-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold-400">
                Marketing
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Ad creatives</h1>
            </div>

            {/* Dimension first: everything below is that dimension's set. */}
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

          <div className="mt-4 flex flex-col gap-2.5 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:gap-6">
            <FilterRow label="Type">
              {(["all", "static", "spot", "ad"] as KindFilter[]).map((k) => (
                <Chip
                  key={k}
                  active={kind === k}
                  onClick={() => setKind(k)}
                  count={kindCount(k)}
                  label={k === "all" ? "All" : KIND_LABEL[k]}
                />
              ))}
            </FilterRow>

            <FilterRow label="Audience">
              {audiences.map((a) => (
                <Chip
                  key={a}
                  active={audience === a}
                  onClick={() => setAudience(a)}
                  count={audienceCount(a)}
                  label={a === "all" ? "All" : AUDIENCE_LABEL[a]}
                />
              ))}
            </FilterRow>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-5 text-[13px] text-white/45">
          Showing <b className="text-white/80">{shown.length}</b> of {creatives.length} at{" "}
          {fmt.w}&times;{fmt.h}
          {kind !== "all" || audience !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setKind("all")
                setAudience("all")
              }}
              className="ml-3 cursor-pointer font-semibold text-gold-400 transition-colors hover:text-gold-300"
            >
              Clear filters
            </button>
          ) : null}
        </p>

        {shown.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-6 text-[14px] text-white/50 ring-1 ring-white/10">
            Nothing matches those two filters together.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((c) => {
            const src = `/dev/creatives/file/${c.name}.html${fmt.hash}`
            const isVideo = c.kind !== "static"
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
                  {/* The whole point of this badge: two cards can carry the
                      same words and only one of them moves. */}
                  {isVideo ? (
                    <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur">
                      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {c.durationMs ? `${(c.durationMs / 1000).toFixed(0)}s` : "Video"}
                    </span>
                  ) : null}
                </div>

                <figcaption className="mt-3 w-[288px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${KIND_TONE[c.kind]}`}
                    >
                      {KIND_LABEL[c.kind]}
                    </span>
                    <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-white/55 ring-1 ring-white/10">
                      {AUDIENCE_LABEL[c.audience]}
                    </span>
                    {c.isNew ? (
                      <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-950">
                        New
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 truncate text-[15px] font-semibold">{c.name}</p>

                  {c.twin ? (
                    <p className="mt-0.5 truncate text-[12px] text-white/40">
                      Also {c.kind === "static" ? "a video" : "an image"}:{" "}
                      <span className="text-white/60">{c.twin}</span>
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold">
                    {/* Rendered on demand at full export size, so what lands in
                        Downloads is what the CLI would have produced. */}
                    <a
                      href={`/dev/creatives/download/${c.name}/${format}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-gold-500 px-2.5 py-1 text-ink-950 transition-colors hover:bg-gold-400"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {fmt.w}&times;{fmt.h}
                    </a>
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer text-white/55 transition-colors hover:text-white"
                    >
                      Open
                    </a>
                    {isVideo ? (
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
          These are the authored sources, playing live. The gold button renders the postable file
          at full export size for the dimension selected above: PNG for images, MP4 for video. The
          first click on a creative costs a render, the rest are instant. To export everything at
          once instead:
          <code className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-white/70">
            node scripts/marketing/render-creatives.mjs &lt;outDir&gt;
          </code>
        </p>
      </main>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
        {label}
      </span>
      {children}
    </div>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0 && !active}
      className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-white text-ink-950"
          : "bg-white/[0.07] text-white/65 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
      }`}
    >
      {label}
      <span className={active ? "ml-1.5 text-ink-950/50" : "ml-1.5 text-white/35"}>{count}</span>
    </button>
  )
}
