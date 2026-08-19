"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { DemoPlayer } from "@/components/demo-directory/player"
import { yourWeekStory } from "@/components/demo-directory/stories/your-week-story"

/**
 * The demo strip (draft, 2026-08-19).
 *
 * WHY THIS EXISTS
 * The demo directory is the most finished thing on the site: a real beat
 * engine, an animated cursor, emphasis rings, callouts, thirteen stories. The
 * homepage only LINKS to it, from DemoCards, near the bottom. A visitor who
 * does not click never sees any of it. This puts one story on the page.
 *
 * WHY IT SITS HERE, AND WHY IT IS DARK
 * Between the navy hero and the white Screenshots section. The hero sells the
 * idea, the screenshots show the surfaces, and this shows the product moving,
 * so it belongs between them. It is `bg-ink-950` rather than a light band so
 * the page still reads navy → dark → white: two lights in a row would lose the
 * boundary, and the player's own chrome is light, so it pops on dark.
 *
 * WHY IT DOES NOT AUTOPLAY ON MOUNT
 * `autoStart` on mount would run a full beat script off-screen, behind the
 * hero: a visitor who scrolls down after ten seconds arrives to find the story
 * already a third of the way through. So it starts on first intersection.
 *
 * DemoPlayer reads `autoStart` as INITIAL state (`useState(autoStart)`), so
 * flipping the prop after mount does nothing. The first drive of this file
 * caught that: the strip rendered, sat on "Play" and never moved. The player
 * therefore has to be MOUNTED at the moment it should start, which is why the
 * panel reserves its height and swaps a still placeholder for the live player
 * rather than just toggling a prop.
 *
 * `your-week` is the story chosen on purpose: it is the one already rebuilt to
 * the realism standard (real anatomy, human pace, 55s), and it is the parent
 * story, which is the audience this page is written for.
 */
export function DemoStrip() {
  const ref = useRef<HTMLElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || started) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setStarted(true)
        io.disconnect()
      },
      /* Half the strip on screen: enough that the viewer is looking at it,
         not merely scrolling past its top edge. */
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [started])

  return (
    <section ref={ref} className="bg-ink-950 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-gold-400">
            Watch it work
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A parent&apos;s week, start to finish.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[17px] text-white/60">
            No sign-up. This is the real product, running.
          </p>
        </div>

        {/* The height is reserved so mounting the player on intersection does
            not shove the page down under the reader's thumb. */}
        <div className="mt-7 min-h-[420px] rounded-xl border border-white/12 bg-[#f8f9fb] p-1.5 shadow-[0_50px_130px_-60px_rgba(0,0,0,0.95)] sm:min-h-[540px] sm:rounded-2xl sm:p-2">
          {started ? (
            <DemoPlayer
              script={yourWeekStory}
              role="Parent"
              roleTone="parent"
              autoStart
              reserveBelow={116}
            />
          ) : (
            <StripPlaceholder />
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/demos"
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-white/25 bg-white/10 px-7 py-3 text-[17px] font-bold text-white transition-colors hover:border-white/40 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            See all 13 demos
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * What the panel holds before the strip is scrolled to.
 *
 * It carries the story's real chapter names, so the box is never a blank
 * rectangle and the reader can see what is coming before it starts.
 */
function StripPlaceholder() {
  return (
    <div className="flex h-full min-h-[416px] flex-col items-center justify-center gap-5 px-6 py-10 sm:min-h-[536px]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-950">
        <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <p className="text-center text-[15px] font-semibold text-ink-500">
        Starts when you reach it.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {yourWeekStory.chapters.map((chapter, i) => (
          <span
            key={chapter.id}
            className="rounded-full bg-ink-100 px-3 py-1.5 text-[13px] font-semibold text-ink-600"
          >
            {i + 1}. {chapter.title}
          </span>
        ))}
      </div>
    </div>
  )
}
