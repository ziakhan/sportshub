"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui"

interface StageInfo {
  n: number
  title: string
  whatToShow: string
}
interface ScenarioInfo {
  key: string
  title: string
  description: string
  estMinutes: number
  stages: StageInfo[] | null
}
interface StatusPayload {
  load: {
    state: "running" | "done" | "failed"
    scenario: string
    stage?: number
    startedAt: string
    finishedAt?: string
  } | null
  logTail: string[]
  world: { scenario: string; stage: number; loadedAt: string } | null
}

export function DemoLoader({ scenarios }: { scenarios: ScenarioInfo[] }) {
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/demos/status").catch(() => null)
    if (res?.ok) setStatus(await res.json())
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  const running = status?.load?.state === "running"

  const load = async (scenario: string, stage?: number, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setError(null)
    const res = await fetch("/api/admin/demos/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, stage }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Couldn't start the load")
    }
    refresh()
  }

  const world = status?.world

  return (
    <div className="mt-6 space-y-5">
      {running && (
        <div className="border-gold-300 bg-gold-50 rounded-2xl border p-4">
          <p className="text-gold-900 text-sm font-semibold">
            Loading {status?.load?.scenario}
            {status?.load?.stage ? ` · stage ${status.load.stage}` : ""}…
          </p>
          <pre className="text-gold-800 mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px]">
            {(status?.logTail ?? []).join("\n")}
          </pre>
        </div>
      )}
      {status?.load?.state === "failed" && (
        <div className="border-hoop-300 bg-hoop-50 rounded-2xl border p-4">
          <p className="text-hoop-900 text-sm font-semibold">Last load failed — log tail:</p>
          <pre className="text-hoop-800 mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px]">
            {(status?.logTail ?? []).join("\n")}
          </pre>
        </div>
      )}
      {error && <p className="text-hoop-700 text-sm">{error}</p>}

      {scenarios.map((s) => {
        const isCurrent = world?.scenario === s.key
        return (
          <section key={s.key} className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-ink-900 text-base font-bold">
                {s.title}
                {isCurrent && (
                  <span className="bg-court-100 text-court-800 ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase">
                    loaded{world?.stage ? ` · stage ${world.stage}` : ""}
                  </span>
                )}
              </h2>
              <span className="text-ink-400 text-xs">~{s.estMinutes} min</span>
            </div>
            <p className="text-ink-600 mt-1 text-sm">{s.description}</p>

            {s.stages ? (
              <div className="mt-4 space-y-2">
                {s.stages.map((st) => {
                  const reached = isCurrent && (world?.stage ?? 0) >= st.n
                  const isNext = isCurrent && (world?.stage ?? 0) + 1 === st.n
                  return (
                    <div
                      key={st.n}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${
                        reached ? "border-court-200 bg-court-50" : "border-ink-100"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          reached ? "bg-court-600 text-white" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {st.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ink-800 text-sm font-medium">{st.title}</p>
                        <p className="text-ink-500 text-xs">{st.whatToShow}</p>
                      </div>
                      {st.n === 1 && (
                        <Button
                          size="sm"
                          variant={isCurrent ? "secondary" : "primary"}
                          tone="play"
                          disabled={running}
                          onClick={() =>
                            load(
                              s.key,
                              1,
                              "Load stage 1? This REPLACES the entire demo world (real users and clubs are untouched)."
                            )
                          }
                        >
                          {isCurrent ? "Reload stage 1" : "Load stage 1"}
                        </Button>
                      )}
                      {isNext && st.n > 1 && (
                        <Button size="sm" tone="court" disabled={running} onClick={() => load(s.key, st.n)}>
                          Fast forward →
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4">
                <Button
                  size="sm"
                  tone="play"
                  disabled={running}
                  onClick={() =>
                    load(
                      s.key,
                      undefined,
                      "Load this demo? This REPLACES the entire demo world (real users and clubs are untouched)."
                    )
                  }
                >
                  {isCurrent ? "Reload" : "Load"}
                </Button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
