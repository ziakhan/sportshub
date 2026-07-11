import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { Badge, Button, PanelHeader, type BadgeTone } from "@/components/ui"
import { programLifecycle } from "@/lib/lifecycle"

interface HouseLeagueSignupRow {
  id: string
  status: string
  notes: string | null
  createdAt: Date
  player: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
  }
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

interface HouseLeagueWithSignups {
  id: string
  name: string
  ageGroups: string
  gender: string | null
  season: string | null
  startDate: Date
  endDate: Date
  daysOfWeek: string
  startTime: string
  endTime: string
  location: string
  maxParticipants: number | null
  isPublished: boolean
  signups: HouseLeagueSignupRow[]
}

const STATUS_TONES: Record<string, BadgeTone> = {
  REGISTERED: "court",
  CONFIRMED: "court",
  WAITLISTED: "gold",
  CANCELLED: "neutral",
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

/** Age in whole years from a date of birth (null when unknown/invalid). */
function ageFrom(dateOfBirth: Date | string | null): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

async function getHouseLeagueWithSignups(
  houseLeagueId: string,
  tenantId: string
): Promise<HouseLeagueWithSignups | null> {
  // Scoped by tenantId — a house league id from another club 404s.
  return await (prisma as any).houseLeague.findFirst({
    where: { id: houseLeagueId, tenantId },
    include: {
      signups: {
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export default async function HouseLeagueSignupsPage({
  params,
}: {
  params: { id: string; houseLeagueId: string }
}) {
  const houseLeague = await getHouseLeagueWithSignups(params.houseLeagueId, params.id)
  if (!houseLeague) notFound()

  const activeSignups = houseLeague.signups.filter((s) => s.status !== "CANCELLED")
  const lifecycle = programLifecycle({
    isPublished: houseLeague.isPublished,
    startAt: houseLeague.startDate,
    endAt: houseLeague.endDate,
    maxParticipants: houseLeague.maxParticipants,
    signupCount: activeSignups.length,
  })

  const filledPct = houseLeague.maxParticipants
    ? Math.min(100, Math.round((activeSignups.length / houseLeague.maxParticipants) * 100))
    : 0
  const ageGroups = houseLeague.ageGroups.split(",").join(" / ")

  return (
    <div>
      <div className="mb-6">
        <Button
          href={`/clubs/${params.id}/house-leagues`}
          variant="subtle"
          size="sm"
          icon={ICONS.back}
        >
          Back to House Leagues
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
              {houseLeague.name}
            </h2>
            <Badge tone={lifecycle.badge.tone} dot={lifecycle.badge.dot}>
              {lifecycle.label}
            </Badge>
          </div>
          <div className="text-ink-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {houseLeague.season && <span>{houseLeague.season}</span>}
            <span>
              {format(new Date(houseLeague.startDate), "MMM d")} &ndash;{" "}
              {format(new Date(houseLeague.endDate), "MMM d, yyyy")}
            </span>
            <span>
              {houseLeague.daysOfWeek} {houseLeague.startTime}&ndash;{houseLeague.endTime}
            </span>
            <span>{houseLeague.location}</span>
            <span>
              {ageGroups}
              {houseLeague.gender ? ` • ${houseLeague.gender}` : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            href={`/clubs/${params.id}/house-leagues/${params.houseLeagueId}/edit`}
            variant="subtle"
            size="sm"
            icon={ICONS.pencil}
          >
            Edit
          </Button>
          <Button
            href={`/house-league/${params.houseLeagueId}`}
            variant="subtle"
            size="sm"
            icon={ICONS.eye}
          >
            View public page
          </Button>
        </div>
      </div>

      {/* Capacity summary */}
      {houseLeague.maxParticipants ? (
        <div className="reveal border-ink-100 shadow-soft mb-6 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-ink-800 text-sm font-semibold">
              {activeSignups.length} of {houseLeague.maxParticipants} spots filled
            </p>
            <span className="text-ink-500 text-xs">
              {houseLeague.maxParticipants - activeSignups.length > 0
                ? `${houseLeague.maxParticipants - activeSignups.length} left`
                : "Full"}
            </span>
          </div>
          <div className="bg-ink-100 mt-2.5 h-2 overflow-hidden rounded-full">
            <div
              className="grow-x h-2 rounded-full bg-[var(--brand)]"
              style={{ width: `${filledPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {houseLeague.signups.length === 0 ? (
        <div className="reveal border-ink-300 shadow-soft rounded-3xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-condensed text-ink-950 mb-2 text-xl font-bold uppercase tracking-wide">
            No registrations yet
          </h3>
          <p className="text-ink-600 mb-6">
            Once parents register their kids, they&apos;ll appear here.
          </p>
          <Button href={`/house-league/${params.houseLeagueId}`} variant="subtle" icon={ICONS.eye}>
            View public page
          </Button>
        </div>
      ) : (
        <div className="reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white">
          <PanelHeader
            variant="band"
            title="Registrants"
            action={
              <span className="text-ink-600 text-sm font-semibold">
                {activeSignups.length} registered
                {houseLeague.signups.length > activeSignups.length
                  ? ` • ${houseLeague.signups.length - activeSignups.length} cancelled`
                  : ""}
              </span>
            }
          />
          {/* Phone shape (responsive-design-concept.md, Shape 1): cards with
              who/status; everything else opens per row. The full table stays
              for sm+ untouched. */}
          <div className="divide-ink-100 divide-y sm:hidden">
            {houseLeague.signups.map((signup) => {
              const age = ageFrom(signup.player?.dateOfBirth ?? null)
              const playerName = signup.player
                ? `${signup.player.firstName} ${signup.player.lastName}`
                : "—"
              const parentName =
                [signup.user.firstName, signup.user.lastName].filter(Boolean).join(" ") || "—"
              return (
                <details key={signup.id} className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="text-ink-900 font-medium">{playerName}</div>
                      <div className="text-ink-500 truncate text-xs">{parentName}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={STATUS_TONES[signup.status] || "neutral"}>
                        {statusLabel(signup.status)}
                      </Badge>
                      <span className="text-ink-400 transition-transform group-open:rotate-90">›</span>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <MobileField label="Parent">
                      {parentName} · {signup.user.email}
                    </MobileField>
                    <MobileField label="Age">{age ?? "—"}</MobileField>
                    <MobileField label="Registered">
                      {format(new Date(signup.createdAt), "MMM d, yyyy")}
                    </MobileField>
                    {signup.notes && <MobileField label="Notes">{signup.notes}</MobileField>}
                  </div>
                </details>
              )
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="divide-ink-100 min-w-full divide-y">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Player</Th>
                  <Th>Age</Th>
                  <Th>Parent</Th>
                  <Th>Status</Th>
                  <Th>Registered</Th>
                </tr>
              </thead>
              <tbody className="divide-ink-100 divide-y">
                {houseLeague.signups.map((signup) => {
                  const age = ageFrom(signup.player?.dateOfBirth ?? null)
                  return (
                    <tr key={signup.id}>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-ink-900 font-medium">
                          {signup.player
                            ? `${signup.player.firstName} ${signup.player.lastName}`
                            : "—"}
                        </div>
                        {signup.notes && (
                          <div className="text-ink-500 mt-0.5 text-xs">{signup.notes}</div>
                        )}
                      </td>
                      <td className="text-ink-600 whitespace-nowrap px-6 py-4 text-sm">
                        {age ?? "—"}
                      </td>
                      <td className="text-ink-600 whitespace-nowrap px-6 py-4 text-sm">
                        <div>
                          {[signup.user.firstName, signup.user.lastName]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </div>
                        <div className="text-ink-400 text-xs">{signup.user.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge tone={STATUS_TONES[signup.status] || "neutral"}>
                          {statusLabel(signup.status)}
                        </Badge>
                      </td>
                      <td className="text-ink-500 whitespace-nowrap px-6 py-4 text-sm">
                        {format(new Date(signup.createdAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-ink-400 w-24 shrink-0 text-xs font-semibold uppercase leading-5 tracking-wide">
        {label}
      </span>
      <span className="text-ink-700 min-w-0">{children}</span>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
      {children}
    </th>
  )
}

/** Leading SVG icons for the kit Buttons (the Button component sizes them). */
const ICONS: Record<string, ReactNode> = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}
