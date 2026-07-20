"use client"

/**
 * Chapter 2 — Club setup (steps 7-9): claim the existing club page (or create
 * a new club), create a team, assign staff. Mirrors /clubs/create, the public
 * claim wizard, and /clubs/[id]/teams/create (docs/demo-inventory/club.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { Advance } from "../advance"
import { CLUB, STAFF, TEAM } from "../data"
import { AreaBox, Field, OperatorPage, SelectBox, SuccessPanel, TxtInput } from "./shared"

/* Step 7a — Search first: is your club already listed? */
export function SceneClubSearch() {
  return (
    <OperatorPage
      narrow
      title="Create Your Club"
      subtitle="Set up your youth basketball club and start managing teams, tryouts, and more."
    >
      <Card>
        <h3 className="text-ink-900 text-lg font-bold">Is your club already listed?</h3>
        <p className="text-ink-500 mt-1 text-sm">
          We&apos;ve mapped over a thousand Canadian clubs. If yours is here, claim it and you keep its
          league connections and public page instead of starting from zero.
        </p>
        <div className="mt-4">
          <TxtInput value="Burlington Force" placeholder="Search by club name or city…" />
        </div>
        <div className="border-ink-100 mt-3 divide-y rounded-xl border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-ink-900 text-sm font-bold">{CLUB.name}</p>
              <p className="text-ink-500 text-xs">Burlington, ON</p>
            </div>
            <Advance>
              <Button size="sm">This is my club</Button>
            </Advance>
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
        <div className="mt-4">
          <Button variant="subtle" block>
            My club isn&apos;t listed. Create a new one
          </Button>
        </div>
      </Card>
      <div className="bg-court-50 border-court-100 mt-4 rounded-2xl border p-5">
        <p className="text-court-800 mb-2 text-sm font-bold">What&apos;s included:</p>
        <ul className="text-court-700 space-y-1 text-sm">
          <li>✓ Create and manage unlimited teams</li>
          <li>✓ Host tryouts and collect registrations</li>
          <li>✓ Accept payments with Stripe Connect</li>
          <li>✓ Join leagues and schedule games</li>
          <li>✓ Track player stats and standings</li>
        </ul>
      </div>
    </OperatorPage>
  )
}

function ClaimShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center px-10 py-12">
      <Card className="w-full max-w-xl">
        <p className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
          Claim your club
        </p>
        <h1 className="font-condensed text-ink-950 mt-1 text-3xl font-bold uppercase tracking-wide">
          {CLUB.name}
        </h1>
        <p className="text-ink-500 mt-0.5 text-sm">Burlington, ON</p>
        <div className="mt-5">{children}</div>
      </Card>
    </div>
  )
}

/* Step 7b — Claim: choose a verification channel */
export function SceneClaimOptions() {
  return (
    <ClaimShell>
      <p className="text-ink-600 text-sm">
        To prove you run this club, we send a code to the contact info already on file. No
        account needed yet.
      </p>
      <div className="mt-4 space-y-2.5">
        <div className="border-play-400 bg-play-50/50 w-full rounded-xl border px-4 py-3 text-sm font-semibold">
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
        <Advance confirm="Verification code sent" block>
          <Button block>Send the code</Button>
        </Advance>
      </div>
    </ClaimShell>
  )
}

/* Step 7c — Claim: enter the code */
export function SceneClaimCode() {
  return (
    <ClaimShell>
      <p className="text-ink-600 text-sm">
        We sent a 6-digit code to <strong>{CLUB.contactHint}</strong>. It expires in 30 minutes.
      </p>
      <div className="mt-4">
        <TxtInput value="4 8 2 9 1 3" mono />
      </div>
      <div className="mt-5">
        <Advance confirm="Code verified" block>
          <Button block>Verify</Button>
        </Advance>
      </div>
    </ClaimShell>
  )
}

/* Step 7d — Claim verified → take ownership */
export function SceneClaimVerified() {
  return (
    <ClaimShell>
      <Badge tone="success">Verified</Badge>
      <p className="text-ink-600 mt-3 text-sm">
        {CLUB.name} is reserved for you for 14 days. Create an account (any email works) or sign
        in. The club binds to <em>your account</em>, not the inbox that got the code.
      </p>
      <div className="mt-5">
        <Advance block confirm="Club claimed">
          <Button block>Take ownership</Button>
        </Advance>
      </div>
      <p className="text-ink-400 mt-3 text-xs">We also emailed this link to the verified contact.</p>
    </ClaimShell>
  )
}

/* Step 7e — Ownership complete */
export function SceneClaimComplete() {
  return (
    <ClaimShell>
      <Badge tone="success">Club claimed</Badge>
      <p className="text-ink-600 mt-3 text-sm">
        You&apos;re the owner. Everything about the club is now yours to edit.
      </p>
      <div className="mt-5">
        <Advance block>
          <Button block>Go to your club dashboard</Button>
        </Advance>
      </div>
    </ClaimShell>
  )
}

function StaffRow({
  name,
  role,
  pending,
}: {
  name: string
  role: string
  pending?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-2.5",
        pending ? "border-amber-300 border-dashed" : "border-ink-200"
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

/* Steps 8 + 9 — Create team with staff assignment */
export function SceneCreateTeam() {
  return (
    <OperatorPage
      narrow
      back="Back to Teams"
      title="Create New Team"
      subtitle="Add a team to your club and assign coaching staff"
    >
      <div className="space-y-5">
        <Card>
          <h3 className="text-ink-900 mb-4 text-base font-bold">Team Details</h3>
          <div className="space-y-4">
            <Field label="Team Name" required>
              <TxtInput value={TEAM.name} placeholder="Warriors U12" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Age Group" required>
                <SelectBox value="U16" placeholder="Select age group" />
              </Field>
              <Field label="Gender">
                <SelectBox value="Male" placeholder="Select gender" />
              </Field>
            </div>
            <Field label="Season">
              <TxtInput value="Summer 2026" placeholder="Spring 2026" />
            </Field>
          </div>
        </Card>
        <Card>
          <h3 className="text-ink-900 mb-1 text-base font-bold">Practice Days</h3>
          <p className="text-ink-500 mb-4 text-xs">
            Optional. Leave empty if practice days are TBD. Families are only notified when you
            announce the schedule (from the team calendar, closer to the season).
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-center gap-3">
              <SelectBox value="Tuesday" />
              <TxtInput value="18:30" />
              <SelectBox value="90 min" />
              <TxtInput value="Haber Recreation Centre" placeholder="Location (optional)" />
              <span className="text-ink-400">×</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-center gap-3">
              <SelectBox value="Thursday" />
              <TxtInput value="19:00" />
              <SelectBox value="90 min" />
              <TxtInput value="Haber Recreation Centre" placeholder="Location (optional)" />
              <span className="text-ink-400">×</span>
            </div>
            <div className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-2.5 text-center text-sm font-semibold">
              + Add practice day
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="text-ink-900 mb-1 text-base font-bold">Staff Assignment</h3>
          <p className="text-ink-500 mb-4 text-xs">
            Assign coaches and team managers. You can also invite people by email.
          </p>
          <div className="space-y-2.5">
            <StaffRow name={STAFF.headCoach} role="Head Coach" />
            <StaffRow name={STAFF.assistant} role="Assistant Coach" />
            <StaffRow name={STAFF.managerInvite} role="Team Manager" pending />
          </div>
          <div className="border-ink-100 mt-4 border-t pt-4">
            <p className="text-ink-700 mb-2 text-sm font-semibold">Add Existing Staff</p>
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3">
              <SelectBox placeholder="Select a staff member" />
              <SelectBox value="Assistant Coach" />
              <Button variant="secondary" disabled>
                Add
              </Button>
            </div>
          </div>
          <div className="border-ink-100 mt-4 border-t pt-4">
            <p className="text-ink-700 mb-2 text-sm font-semibold">Invite by Email</p>
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3">
              <TxtInput placeholder="staff@example.com" />
              <SelectBox value="Assistant Coach" />
              <Button variant="secondary" disabled>
                Invite
              </Button>
            </div>
            <p className="text-ink-400 mt-2 text-xs">
              The invited person will receive a notification and be assigned to this team once
              they accept.
            </p>
          </div>
        </Card>
        <div className="flex gap-3">
          <Button variant="subtle">Cancel</Button>
          <Advance confirm="Team created" block className="flex-1">
            <Button block>Create Team</Button>
          </Advance>
        </div>
      </div>
    </OperatorPage>
  )
}

/* Team created confirmation */
export function SceneTeamCreated() {
  return (
    <OperatorPage narrow title="Create New Team" subtitle="Add a team to your club and assign coaching staff">
      <SuccessPanel
        title="Team Created!"
        actions={
          <>
            <Advance>
              <Button>View Teams</Button>
            </Advance>
            <Button variant="subtle">Create Another Team</Button>
          </>
        }
      >
        <p>
          <strong>{TEAM.name}</strong> (U16) has been created.
        </p>
        <p className="mt-1">3 staff members assigned/invited.</p>
      </SuccessPanel>
    </OperatorPage>
  )
}
