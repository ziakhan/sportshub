"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui"
import {
  currentAssignment,
  seasonCalendarMonths,
  type PlannerState,
} from "@/lib/scheduler/planner-core"
import type { PlanHeaderInfo } from "./teams-step"

/**
 * Step 4, publish (owner-approved mock, 2026-08-02). The calendar lives on
 * the league's own page, where clubs and families already look, and travels
 * everywhere else as a PNG.
 *
 * The rule the screen is built around: publishing is about a calendar that
 * EXISTS. Nothing here works from a blank board, so a season with no kept
 * plan gets one honest sentence and a way back to step 3 instead of three
 * dead buttons.
 *
 * The preview is the real card, rendered by the same route the poster comes
 * from. An operator sees it before anyone else can: the route serves them
 * pre-publish and 404s for everyone until they say go.
 */

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

// Real apostrophes live here as JS expressions, so nothing needs escaping.
const COPY = {
  noPlan:
    "There is no kept calendar yet. Build one in step 3 and keep it, then this is where you publish it.",
  published:
    "Your calendar is live. It is on the league page now, and the card is yours to post anywhere.",
  unpublished:
    "Taken down. The league page no longer shows the calendar, and the card is private again.",
  locked: "This season is finalized, so the plan can't be published or taken down from here.",
  baseline:
    "Publishing also freezes the plan as this season's baseline: registration caps, the plan-vs-actuals watch and scheduling all read it from here.",
}

const prettyDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })

const fileSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "season"

export function PublishStep({
  seasonId,
  onLoaded,
  onGoToStep,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
  onGoToStep?: (step: number) => void
}) {
  const [state, setState] = useState<PlannerState | null>(null)
  const [header, setHeader] = useState<PlanHeaderInfo>({})
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cardFailed, setCardFailed] = useState(false)
  // Bumped after every publish/unpublish so the browser refetches the PNG
  // instead of showing the one it already has.
  const [cardVersion, setCardVersion] = useState(() => Date.now())

  const load = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(
      () => null
    )
    if (!res?.ok) {
      setError("Couldn't load your calendar")
      return
    }
    const data = await res.json()
    setState(data.state)
    setPublishedAt(data.planPublishedAt ?? null)
    setLocked(LOCKED_STATUSES.includes(data.seasonStatus))
    setHeader({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
    onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
  }, [seasonId, onLoaded])

  useEffect(() => {
    load()
  }, [load])

  const months = useMemo(
    () => (state ? seasonCalendarMonths(state, currentAssignment(state)) : []),
    [state]
  )
  const hasPlan = months.length > 0
  const cardUrl = `/api/seasons/${seasonId}/planner/card?v=${cardVersion}`
  const pageUrl = `/league/${seasonId}#season-calendar`

  const setPublished = async (method: "POST" | "DELETE") => {
    setBusy(method)
    setError(null)
    setNotice(null)
    const res = await fetch(`/api/seasons/${seasonId}/planner/publish`, { method }).catch(
      () => null
    )
    setBusy(null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) {
      setError(data?.error ?? "That didn't work. Try again.")
      return
    }
    setPublishedAt(data?.planPublishedAt ?? null)
    setCardVersion(Date.now())
    setCardFailed(false)
    setNotice(method === "POST" ? COPY.published : COPY.unpublished)
  }

  /** The card, saved to disk. The share dialog elsewhere only ever opens or
   *  shares a card; a poster has to become a file the operator can attach. */
  const download = async () => {
    setBusy("download")
    setError(null)
    const res = await fetch(cardUrl).catch(() => null)
    if (!res?.ok) {
      setBusy(null)
      setError("The card didn't render. Try again in a moment.")
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileSlug(`${header.leagueName ?? "league"} ${header.seasonLabel ?? ""}`)}-calendar.png`
    a.click()
    URL.revokeObjectURL(url)
    setBusy(null)
    setNotice("Card downloaded.")
  }

  if (!state && !error) {
    return <p className="text-ink-500 p-6 text-sm">Loading your calendar…</p>
  }

  return (
    <div className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">Publish your season</p>
          <p className="text-ink-500 text-xs">card + live page + registration</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
            publishedAt
              ? "border-court-200 bg-court-50 text-court-800"
              : "border-ink-200 bg-ink-50 text-ink-500"
          }`}
        >
          {publishedAt ? `Published ${prettyDate(publishedAt)}` : "Not published yet"}
        </span>
      </div>

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {COPY.locked}
          </p>
        )}
        {error && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="border-court-200 bg-court-50 text-court-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {notice}
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          {/* The poster, exactly as it will travel. */}
          <div>
            {hasPlan && !cardFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardUrl}
                alt={`${header.leagueName ?? "League"} season calendar`}
                data-testid="calendar-card-preview"
                onError={() => setCardFailed(true)}
                className="border-ink-100 w-full rounded-xl border"
              />
            ) : (
              <div className="border-ink-200 rounded-xl border border-dashed p-6">
                <p className="text-ink-600 text-sm">
                  {cardFailed
                    ? "The card didn't render just now. Reload to try again."
                    : COPY.noPlan}
                </p>
                {!cardFailed && onGoToStep && (
                  <button
                    type="button"
                    onClick={() => onGoToStep(3)}
                    className="text-play-700 hover:text-play-800 mt-3 text-sm font-semibold"
                  >
                    Go to step 3 &rarr;
                  </button>
                )}
              </div>
            )}
            <p className="text-ink-400 mt-2 text-xs">
              {hasPlan
                ? `${months.length} month${months.length === 1 ? "" : "s"} of weekends, straight from the calendar you kept.`
                : "The card builds itself from your calendar."}
            </p>
          </div>

          {/* The three things publishing gets you. */}
          <div className="flex flex-col gap-2.5">
            <ActionRow
              testId="row-page"
              title="League page"
              note="the calendar appears where families already look"
              action={
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-ink-200 text-ink-700 hover:bg-ink-50 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  Preview
                </a>
              }
            />
            <ActionRow
              testId="row-download"
              title="Download card"
              note="PNG for Instagram, print, email"
              action={
                <Button
                  size="sm"
                  variant="subtle"
                  disabled={!hasPlan || busy !== null}
                  onClick={download}
                >
                  {busy === "download" ? "Working…" : "Download"}
                </Button>
              }
            />
            <ActionRow
              testId="row-publish"
              title={publishedAt ? "Published" : "Publish & open registration"}
              note={
                publishedAt
                  ? `Live since ${prettyDate(publishedAt)}. Publish again after an edit to re-announce it.`
                  : "saves the plan as this season's baseline"
              }
              action={
                <Button
                  size="sm"
                  tone="court"
                  variant={publishedAt ? "secondary" : "primary"}
                  disabled={!hasPlan || locked || busy !== null}
                  onClick={() => setPublished("POST")}
                >
                  {busy === "POST" ? "Publishing…" : publishedAt ? "Republish" : "Publish"}
                </Button>
              }
            />

            {publishedAt && !locked && (
              <button
                type="button"
                data-testid="unpublish-plan"
                disabled={busy !== null}
                onClick={() => setPublished("DELETE")}
                className="text-ink-400 hover:text-hoop-700 self-start px-1 text-xs font-semibold disabled:opacity-50"
              >
                {busy === "DELETE" ? "Taking it down…" : "Take the calendar down"}
              </button>
            )}

            <p className="text-ink-400 mt-1 px-1 text-xs">{COPY.baseline}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** One row of the rail: what it does, why it matters, and the button. */
function ActionRow({
  testId,
  title,
  note,
  action,
}: {
  testId: string
  title: string
  note: string
  action: React.ReactNode
}) {
  return (
    <div
      data-testid={testId}
      className="border-ink-100 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3"
    >
      <span className="min-w-0">
        <span className="text-ink-900 block text-sm font-semibold">{title}</span>
        <span className="text-ink-500 block text-xs">{note}</span>
      </span>
      {action}
    </div>
  )
}
