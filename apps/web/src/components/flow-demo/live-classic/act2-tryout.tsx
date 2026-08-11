"use client"

/**
 * Act 2 — The head coach creates the tryout with full details (location,
 * time, fee, capacity) and publishes it to the marketplace. Mirrors
 * /clubs/[id]/tryouts/create and /clubs/[id]/tryouts.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/components/ui/cn"
import { TEAM, TRYOUT } from "../data"
import { Field, OperatorPage, SuccessPanel } from "../scenes/shared"
import { LiveCheck, LiveInput, LiveSelect } from "./anim"
import type { LiveScene } from "./engine"
import { pick, tick, typeIn } from "./helpers"

const COACH = "Coach David (Force)"

const Hold = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <span data-live-id={id} className="inline-block rounded-xl">
    {children}
  </span>
)

/* 8 — Create the tryout, every detail */
const createTryout: LiveScene = {
  id: "l-create-tryout",
  act: "tryout",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/tryouts/create",
  caption:
    "The coach fills in the whole thing: date and time, the gym, the fee, capacity. Age group and gender come from the team itself.",
  script: [
    { zoom: "detailsSec", scale: 1.22 },
    ...pick("teamSel", "team", 0, `${TEAM.name} (U16 / Boys)`),
    { set: { badges: true } },
    { wait: 400 },
    ...typeIn("title", "title", TRYOUT.title, 28),
    ...typeIn("loc", "loc", TRYOUT.location, 30),
    { zoom: "schedSec", scale: 1.25 },
    ...typeIn("when", "when", "2026-04-07 6:30 PM", 26),
    ...typeIn("dur", "dur", "90", 12),
    { zoom: "feeSec", scale: 1.25 },
    ...typeIn("fee", "fee", "25.00", 12),
    ...typeIn("max", "max", "40", 10),
    ...tick("pubCheck", "pub"),
    { zoom: null },
    { hold: "createBtn" },
  ],
  render: (g) => (
    <OperatorPage
      narrow
      back="Back to Tryouts"
      title="Create Tryout"
      subtitle="Set up a tryout for your club. You can publish it to the marketplace after creation."
    >
      <Card>
        <div data-live-id="detailsSec">
          <PanelHeader title="Tryout details" />
          <div className="space-y-4">
            <Field label="Team" required>
              <LiveSelect
                id="teamSel"
                value={g("team") as string}
                placeholder="Select a team"
                open={!!g("team:open")}
                options={[`${TEAM.name} (U16 / Boys)`]}
                highlight={g("team:hi") as number}
              />
            </Field>
            {!!g("badges") && (
              <div className="live-row-in flex gap-2">
                <Badge tone="play">Age group · U16</Badge>
                <Badge tone="play">Boys</Badge>
              </div>
            )}
            <Field label="Title" required>
              <LiveInput id="title" value={g("title") as string} caret={!!g("title:caret")} placeholder="Spring 2026 U12 Boys Tryout" />
            </Field>
            <Field label="Location" required>
              <LiveInput id="loc" value={g("loc") as string} caret={!!g("loc:caret")} placeholder="Main Gym, 123 Court Ave" />
            </Field>
          </div>
        </div>
        <div data-live-id="schedSec">
          <PanelHeader title="Schedule" className="mt-6" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date & Time" required>
              <LiveInput id="when" value={g("when") as string} caret={!!g("when:caret")} placeholder="Pick a date and time" />
            </Field>
            <Field label="Duration (minutes)">
              <LiveInput id="dur" value={g("dur") as string} caret={!!g("dur:caret")} placeholder="90" />
            </Field>
          </div>
        </div>
        <div data-live-id="feeSec">
          <PanelHeader title="Fee & capacity" className="mt-6" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fee ($)" required>
              <LiveInput id="fee" value={g("fee") as string} caret={!!g("fee:caret")} placeholder="0.00" />
            </Field>
            <Field label="Max Participants">
              <LiveInput id="max" value={g("max") as string} caret={!!g("max:caret")} placeholder="No limit" />
            </Field>
          </div>
          <LiveCheck
            id="pubCheck"
            on={!!g("pub")}
            className="mt-4"
            label="Public tryout (visible on marketplace when published)"
          />
          <p className="text-ink-400 mt-3 text-xs">
            Tryouts are saved as drafts. You can publish them to the marketplace from the tryouts
            list.
          </p>
        </div>
      </Card>
      <div className="mt-4 flex gap-3">
        <Button variant="subtle">Cancel</Button>
        <span data-live-id="createBtn" className="block flex-1 rounded-xl">
          <Button block>Create Tryout</Button>
        </span>
      </div>
    </OperatorPage>
  ),
}

/* 9 — Created as a draft */
const tryoutCreated: LiveScene = {
  id: "l-tryout-created",
  act: "tryout",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/tryouts/create",
  caption: "Saved as a draft. Nothing is public until the coach says so.",
  script: [{ wait: 450 }, { set: { show: true } }, { wait: 900 }, { hold: "viewBtn" }],
  render: (g) => (
    <OperatorPage narrow back="Back to Tryouts" title="Create Tryout" subtitle="Set up a tryout for your club.">
      {!!g("show") && (
        <div className="live-pop">
          <SuccessPanel
            title="Tryout Created!"
            actions={
              <>
                <Hold id="viewBtn">
                  <Button>View Tryouts</Button>
                </Hold>
                <Button variant="subtle">Create Another Tryout</Button>
              </>
            }
          >
            <p>
              <strong>{TRYOUT.title}</strong> has been created as a draft.
            </p>
            <p className="mt-1">You can publish it to the marketplace from the tryouts list.</p>
          </SuccessPanel>
        </div>
      )}
    </OperatorPage>
  ),
}

/* 10 — Publish it */
const publishTryout: LiveScene = {
  id: "l-publish",
  act: "tryout",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/tryouts",
  caption: "One click puts it on the marketplace where parents browse.",
  script: [
    { wait: 400 },
    { cursor: "publishBtn" },
    { hold: "publishBtn" },
    { set: { published: true } },
    { wait: 500 },
    { confirm: "Published to the marketplace" },
    { wait: 300 },
  ],
  render: (g) => (
    <div className="px-10 py-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">Tryouts</h2>
        <Button size="sm">Create Tryout</Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          "All (1)",
          g("published") ? "Published (1)" : "Published (0)",
          g("published") ? "Draft (0)" : "Draft (1)",
          "Needs Offer (0)",
          "Past (0)",
        ].map((p, i) => (
          <span
            key={p}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              i === 0 ? "bg-ink-900 text-white" : "bg-white text-ink-600 border-ink-200 border"
            )}
          >
            {p}
          </span>
        ))}
      </div>
      <div data-live-id="row"><Card size="sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-ink-900 text-base font-bold">{TRYOUT.title}</p>
              {g("published") ? (
                <span className="live-pop inline-block">
                  <Badge tone="court">Published</Badge>
                </span>
              ) : (
                <Badge tone="hoop">Draft</Badge>
              )}
              <Badge tone="play">{TEAM.name}</Badge>
            </div>
            <p className="text-ink-500 mt-1 text-sm">
              Apr 7, 2026 at 6:30 PM · {TRYOUT.location} · U16
            </p>
            <p className="text-ink-500 mt-1 text-sm">0 / 40 signups</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="subtle">Signups</Button>
            <Button size="sm" variant="subtle">Edit</Button>
            <Button size="sm" variant="subtle">Public listing</Button>
            <Hold id="publishBtn">
              <Button size="sm" variant={g("published") ? "subtle" : "primary"}>
                {g("published") ? "Unpublish" : "Publish"}
              </Button>
            </Hold>
          </div>
        </div>
      </Card></div>
    </div>
  ),
}

export const ACT2: LiveScene[] = [createTryout, tryoutCreated, publishTryout]
