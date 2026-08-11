"use client"

/**
 * Act 1 — The club signs up: claims its existing page, creates the team,
 * assigns staff (head coach, assistant, team manager by email), then hands
 * off to the head coach. Screens mirror /clubs/create, /claim/[tenantId],
 * and /clubs/[id]/teams/create (docs/demo-inventory/club.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { CLUB, STAFF, TEAM } from "../data"
import { Field, OperatorPage, SuccessPanel } from "../scenes/shared"
import { LiveCheck, LiveInput, LiveSelect } from "./anim"
import type { LiveScene } from "./engine"
import { pick, typeIn } from "./helpers"

const Hold = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <span data-live-id={id} className="inline-block rounded-xl">
    {children}
  </span>
)

/* 1 — Search first, find the club */
const clubSearch: LiveScene = {
  id: "l-club-search",
  act: "club",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/clubs/create",
  caption:
    "Signing up starts with a search: over a thousand Canadian clubs are already mapped, so the Force's page is already here.",
  script: [
    { zoom: "searchCard", scale: 1.25 },
    ...typeIn("search", "q", "Burlington Force"),
    { set: { results: true } },
    { wait: 500 },
    { zoom: null },
    { hold: "claimBtn" },
  ],
  render: (g) => (
    <OperatorPage
      narrow
      title="Create Your Club"
      subtitle="Set up your youth basketball club and start managing teams, tryouts, and more."
    >
      <div data-live-id="searchCard"><Card>
        <h3 className="text-ink-900 text-lg font-bold">Is your club already listed?</h3>
        <p className="text-ink-500 mt-1 text-sm">
          We&apos;ve mapped over a thousand Canadian clubs. If yours is here, claim it and you keep
          its league connections and public page instead of starting from zero.
        </p>
        <div className="mt-4">
          <LiveInput
            id="search"
            value={g("q") as string}
            caret={!!g("q:caret")}
            placeholder="Search by club name or city…"
          />
        </div>
        {!!g("results") && (
          <div className="border-ink-100 live-row-in mt-3 divide-y rounded-xl border">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">{CLUB.name}</p>
                <p className="text-ink-500 text-xs">Burlington, ON</p>
              </div>
              <Hold id="claimBtn">
                <Button size="sm">This is my club</Button>
              </Hold>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">Burloak Elite</p>
                <p className="text-ink-500 text-xs">Burlington, ON</p>
              </div>
              <Button size="sm" variant="subtle">
                This is my club
              </Button>
            </div>
          </div>
        )}
        <div className="mt-4">
          <Button variant="subtle" block>
            My club isn&apos;t listed. Create a new one
          </Button>
        </div>
      </Card></div>
    </OperatorPage>
  ),
}

function ClaimShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center px-10 py-12">
      <Card className="w-full max-w-xl">
        <p className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">Claim your club</p>
        <h1 className="font-condensed text-ink-950 mt-1 text-3xl font-bold uppercase tracking-wide">
          {CLUB.name}
        </h1>
        <p className="text-ink-500 mt-0.5 text-sm">Burlington, ON</p>
        <div className="mt-5">{children}</div>
      </Card>
    </div>
  )
}

/* 2 — Pick the verification channel */
const claimOptions: LiveScene = {
  id: "l-claim-options",
  act: "club",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/claim/burlington-force-elite",
  caption: "Ownership is proven with a code sent to the contact info already on file. No account needed yet.",
  script: [
    { wait: 400 },
    { press: "emailChannel" },
    { set: { channel: true } },
    { wait: 500 },
    { hold: "sendBtn" },
  ],
  render: (g) => (
    <ClaimShell>
      <p className="text-ink-600 text-sm">
        To prove you run this club, we send a code to the contact info already on file. No
        account needed yet.
      </p>
      <div className="mt-4 space-y-2.5">
        <div
          data-live-id="emailChannel"
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
            g("channel") ? "border-play-400 bg-play-50/50" : "border-ink-200"
          )}
        >
          Email a code to {CLUB.contactHint}
        </div>
        <div className="border-ink-200 w-full rounded-xl border px-4 py-3 text-sm font-semibold">
          Text a code to (9••) •••-••41
        </div>
        <div className="border-ink-200 w-full rounded-xl border px-4 py-3">
          <p className="text-sm font-semibold">I can&apos;t access those. Submit proof instead</p>
          <p className="text-ink-400 mt-0.5 text-xs">
            Describe your proof (website admin, registration papers, social account) and an admin
            will review it.
          </p>
        </div>
      </div>
      <p className="text-play-700 mt-3 text-xs font-semibold">Our info looks wrong? Propose corrections</p>
      <div className="mt-5">
        <Hold id="sendBtn">
          <Button block className="min-w-[420px]">
            Send the code
          </Button>
        </Hold>
      </div>
    </ClaimShell>
  ),
}

/* 3 — Code arrives, verify, take ownership */
const claimCode: LiveScene = {
  id: "l-claim-code",
  act: "club",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/claim/burlington-force-elite",
  caption: "The 6-digit code lands in the club inbox. It expires in 30 minutes.",
  script: [
    ...typeIn("code", "code", "4 8 2 9 1 3", 10),
    { hold: "verifyBtn" },
    { set: { verified: true } },
    { wait: 700 },
    { hold: "ownBtn" },
    { confirm: "Club claimed" },
  ],
  render: (g) =>
    !g("verified") ? (
      <ClaimShell>
        <p className="text-ink-600 text-sm">
          We sent a 6-digit code to <strong>{CLUB.contactHint}</strong>. It expires in 30 minutes.
        </p>
        <div className="mt-4">
          <LiveInput id="code" value={g("code") as string} caret={!!g("code:caret")} placeholder="••••••" big />
        </div>
        <div className="mt-5">
          <Hold id="verifyBtn">
            <Button block className="min-w-[420px]">
              Verify
            </Button>
          </Hold>
        </div>
      </ClaimShell>
    ) : (
      <ClaimShell>
        <span className="live-pop inline-block">
          <Badge tone="success">Verified</Badge>
        </span>
        <p className="text-ink-600 mt-3 text-sm">
          {CLUB.name} is reserved for you for 14 days. Create an account (any email works) or sign
          in. The club binds to <em>your account</em>, not the inbox that got the code.
        </p>
        <div className="mt-5">
          <Hold id="ownBtn">
            <Button block className="min-w-[420px]">
              Take ownership
            </Button>
          </Hold>
        </div>
        <p className="text-ink-400 mt-3 text-xs">We also emailed this link to the verified contact.</p>
      </ClaimShell>
    ),
}

/* 4 — Owned */
const claimComplete: LiveScene = {
  id: "l-claim-complete",
  act: "club",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/claim/complete",
  caption: "The public page, teams and history now belong to this owner.",
  script: [{ wait: 500 }, { set: { claimed: true } }, { wait: 700 }, { hold: "dashBtn" }],
  render: (g) => (
    <ClaimShell>
      {!!g("claimed") && (
        <span className="live-pop inline-block">
          <Badge tone="success">Club claimed</Badge>
        </span>
      )}
      <p className="text-ink-600 mt-3 text-sm">
        You&apos;re the owner. Everything about the club is now yours to edit.
      </p>
      <div className="mt-5">
        <Hold id="dashBtn">
          <Button block className="min-w-[420px]">
            Go to your club dashboard
          </Button>
        </Hold>
      </div>
    </ClaimShell>
  ),
}

/* 5 — Create the team, assign the whole staff bench */
const AGE_OPTIONS = ["U13", "U14", "U15", "U16", "U17", "U18"]
const GENDER_OPTIONS = ["Male", "Female", "Co-ed"]
const STAFF_OPTIONS = ["David Okafor (Staff)", "Anita Reid (Staff)", "Sam Morgan (Staff)"]
const ROLE_OPTIONS = ["Head Coach", "Assistant Coach", "Team Manager"]

function StaffRow({ name, role, pending }: { name: string; role: string; pending?: boolean }) {
  return (
    <div
      className={cn(
        "live-row-in flex items-center justify-between rounded-xl border px-4 py-2.5",
        pending ? "border-dashed border-amber-300" : "border-ink-200"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-ink-900 text-sm font-semibold">{name}</span>
        <Badge tone={role === "Head Coach" ? "play" : "neutral"}>{role}</Badge>
        {pending && <span className="text-xs font-semibold text-amber-600">Pending invite</span>}
      </div>
      <span className="text-ink-400">×</span>
    </div>
  )
}

const createTeam: LiveScene = {
  id: "l-create-team",
  act: "club",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/clubs/burlington-force/teams/create",
  caption:
    "One form builds the team: head coach and assistant from club staff, the manager invited by email.",
  script: [
    { zoom: "detailsCard", scale: 1.22 },
    ...typeIn("teamName", "name", TEAM.name),
    ...pick("ageSel", "age", 3, "U16"),
    ...pick("genderSel", "gender", 0, "Male"),
    ...typeIn("season", "season", "Summer 2026"),
    { zoom: "staffCard", scale: 1.22 },
    ...pick("staffSel", "staff", 0, "David Okafor (Staff)"),
    ...pick("roleSel", "role", 0, "Head Coach"),
    { press: "addBtn" },
    { set: { row1: true, staff: undefined, role: undefined } },
    { wait: 500 },
    ...pick("staffSel", "staff", 1, "Anita Reid (Staff)"),
    ...pick("roleSel", "role", 1, "Assistant Coach"),
    { press: "addBtn" },
    { set: { row2: true, staff: undefined, role: undefined } },
    { wait: 500 },
    ...typeIn("inviteEmail", "email", STAFF.managerInvite, 30),
    ...pick("roleSel2", "role2", 2, "Team Manager"),
    { press: "inviteBtn" },
    { set: { row3: true, email: undefined } },
    { wait: 600 },
    { zoom: null },
    { hold: "createTeamBtn" },
  ],
  render: (g) => (
    <OperatorPage
      narrow
      back="Back to Teams"
      title="Create New Team"
      subtitle="Add a team to your club and assign coaching staff"
    >
      <div className="space-y-5">
        <div data-live-id="detailsCard"><Card>
          <h3 className="text-ink-900 mb-4 text-base font-bold">Team Details</h3>
          <div className="space-y-4">
            <Field label="Team Name" required>
              <LiveInput id="teamName" value={g("name") as string} caret={!!g("name:caret")} placeholder="Warriors U12" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Age Group" required>
                <LiveSelect
                  id="ageSel"
                  value={g("age") as string}
                  placeholder="Select age group"
                  open={!!g("age:open")}
                  options={AGE_OPTIONS}
                  highlight={g("age:hi") as number}
                />
              </Field>
              <Field label="Gender">
                <LiveSelect
                  id="genderSel"
                  value={g("gender") as string}
                  placeholder="Select gender"
                  open={!!g("gender:open")}
                  options={GENDER_OPTIONS}
                  highlight={g("gender:hi") as number}
                />
              </Field>
            </div>
            <Field label="Season">
              <LiveInput id="season" value={g("season") as string} caret={!!g("season:caret")} placeholder="Spring 2026" />
            </Field>
          </div>
        </Card></div>
        <div data-live-id="staffCard"><Card>
          <h3 className="text-ink-900 mb-1 text-base font-bold">Staff Assignment</h3>
          <p className="text-ink-500 mb-4 text-xs">
            Assign coaches and team managers. You can also invite people by email.
          </p>
          <div className="space-y-2.5">
            {!!g("row1") && <StaffRow name={STAFF.headCoach} role="Head Coach" />}
            {!!g("row2") && <StaffRow name={STAFF.assistant} role="Assistant Coach" />}
            {!!g("row3") && <StaffRow name={STAFF.managerInvite} role="Team Manager" pending />}
          </div>
          <div className={cn("border-ink-100 pt-4", !!(g("row1") || g("row2") || g("row3")) && "mt-4 border-t")}>
            <p className="text-ink-700 mb-2 text-sm font-semibold">Add Existing Staff</p>
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3">
              <LiveSelect
                id="staffSel"
                value={g("staff") as string}
                placeholder="Select a staff member"
                open={!!g("staff:open")}
                options={STAFF_OPTIONS}
                highlight={g("staff:hi") as number}
              />
              <LiveSelect
                id="roleSel"
                value={g("role") as string}
                placeholder="Assistant Coach"
                open={!!g("role:open")}
                options={ROLE_OPTIONS}
                highlight={g("role:hi") as number}
              />
              <span data-live-id="addBtn" className="inline-block rounded-xl">
                <Button variant="secondary">Add</Button>
              </span>
            </div>
          </div>
          <div className="border-ink-100 mt-4 border-t pt-4">
            <p className="text-ink-700 mb-2 text-sm font-semibold">Invite by Email</p>
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3">
              <LiveInput id="inviteEmail" value={g("email") as string} caret={!!g("email:caret")} placeholder="staff@example.com" />
              <LiveSelect
                id="roleSel2"
                value={g("role2") as string}
                placeholder="Assistant Coach"
                open={!!g("role2:open")}
                options={ROLE_OPTIONS}
                highlight={g("role2:hi") as number}
              />
              <span data-live-id="inviteBtn" className="inline-block rounded-xl">
                <Button variant="secondary">Invite</Button>
              </span>
            </div>
            <p className="text-ink-400 mt-2 text-xs">
              The invited person will receive a notification and be assigned to this team once
              they accept.
            </p>
          </div>
        </Card></div>
        <div className="flex gap-3">
          <Button variant="subtle">Cancel</Button>
          <span data-live-id="createTeamBtn" className="block flex-1 rounded-xl">
            <Button block>Create Team</Button>
          </span>
        </div>
      </div>
    </OperatorPage>
  ),
}

/* 6 — Team created */
const teamCreated: LiveScene = {
  id: "l-team-created",
  act: "club",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/clubs/burlington-force/teams/create",
  caption: "Coaches assigned on the spot; the team manager joins when she accepts the email invite.",
  script: [{ wait: 500 }, { set: { show: true } }, { wait: 900 }, { hold: "viewTeamsBtn" }],
  render: (g) => (
    <OperatorPage narrow title="Create New Team" subtitle="Add a team to your club and assign coaching staff">
      {!!g("show") && (
        <div className="live-pop">
          <SuccessPanel
            title="Team Created!"
            actions={
              <>
                <Hold id="viewTeamsBtn">
                  <Button>View Teams</Button>
                </Hold>
                <Button variant="subtle">Create Another Team</Button>
              </>
            }
          >
            <p>
              <strong>{TEAM.name}</strong> (U16) has been created.
            </p>
            <p className="mt-1">3 staff members assigned/invited.</p>
          </SuccessPanel>
        </div>
      )}
    </OperatorPage>
  ),
}

/* 7 — Hand off to the head coach */
const roleSwitch: LiveScene = {
  id: "l-role-switch",
  act: "club",
  persona: "club",
  personaLabel: "Coach David (Force)",
  frame: "plain",
  caption: "The owner's job is done for now. The head coach signs in and takes it from here.",
  script: [{ wait: 400 }, { set: { badge: true } }, { wait: 900 }, { hold: "continueBtn" }],
  render: (g) => (
    <div className="border-ink-100 rounded-2xl border bg-white px-8 py-16 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
      <div className="bg-court-600 mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white">
        DO
      </div>
      <h2 className="font-condensed text-ink-950 mt-4 text-3xl font-bold uppercase tracking-wide">
        David Okafor signs in
      </h2>
      {!!g("badge") && (
        <div className="live-pop mt-2">
          <Badge tone="play">Head Coach · {TEAM.name}</Badge>
        </div>
      )}
      <p className="text-ink-500 mx-auto mt-3 max-w-md text-sm">
        Staff see their teams the moment they are assigned. Time to find some players.
      </p>
      <div className="mt-7">
        <Hold id="continueBtn">
          <Button size="lg">Continue as the coach</Button>
        </Hold>
      </div>
    </div>
  ),
}

export const ACT1: LiveScene[] = [clubSearch, claimOptions, claimCode, claimComplete, createTeam, teamCreated, roleSwitch]
