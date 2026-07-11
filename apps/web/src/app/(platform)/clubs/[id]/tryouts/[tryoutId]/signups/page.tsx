import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import type { ReactNode } from "react"
import { Badge, Button, PanelHeader, toneForStatus } from "@/components/ui"
import { MakeOfferButton } from "./make-offer-button"
import { BulkOfferButton } from "./bulk-offer-button"

interface TryoutSignup {
  id: string
  userId: string
  playerName: string
  playerAge: number | null
  playerGender: string | null
  status: string
  notes: string | null
  checkedInAt: Date | null
  createdAt: Date
  user: { id: string; email: string; firstName: string | null; lastName: string | null }
  offers: { id: string; status: string }[]
}

interface TryoutWithSignups {
  id: string
  title: string
  scheduledAt: Date
  location: string
  ageGroup: string
  team: { id: string; name: string } | null
  signups: TryoutSignup[]
}

async function getTryoutWithSignups(
  tryoutId: string,
  tenantId: string
): Promise<TryoutWithSignups | null> {
  const tryout = await prisma.tryout.findFirst({
    where: { id: tryoutId, tenantId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      location: true,
      ageGroup: true,
      team: { select: { id: true, name: true } },
      signups: {
        where: { status: { not: "CANCELLED" } },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          offers: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  return tryout
}

async function getPlayersForParents(
  parentIds: string[]
): Promise<{ id: string; firstName: string; lastName: string; parentId: string }[]> {
  if (parentIds.length === 0) return []
  return await prisma.player.findMany({
    where: { parentId: { in: parentIds } },
    select: { id: true, firstName: true, lastName: true, parentId: true },
  })
}

export default async function TryoutSignupsPage({
  params,
}: {
  params: { id: string; tryoutId: string }
}) {
  const tryout = await getTryoutWithSignups(params.tryoutId, params.id)

  if (!tryout) {
    return (
      <div className="border-hoop-200 bg-hoop-50 rounded-xl border p-6 text-center">
        <p className="text-hoop-700">Tryout not found.</p>
      </div>
    )
  }

  // Batch fetch all players for all parents in one query
  const parentIds = [...new Set(tryout.signups.map((s) => s.userId))]
  const allPlayers = await getPlayersForParents(parentIds)

  const signupsWithPlayers = tryout.signups.map((signup) => {
    const parentPlayers = allPlayers.filter((p) => p.parentId === signup.userId)
    const matchedPlayer = parentPlayers.find(
      (p) => `${p.firstName} ${p.lastName}` === signup.playerName
    )
    return { ...signup, matchedPlayer, allPlayers: parentPlayers }
  })

  const checkedInCount = signupsWithPlayers.filter((s) => s.checkedInAt).length

  return (
    <div>
      <div className="mb-6">
        <Button
          href={`/clubs/${params.id}/tryouts`}
          variant="subtle"
          size="sm"
          icon={ICONS.back}
        >
          Back to Tryouts
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            {tryout.title} - Signups
          </h2>
          <div className="text-ink-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>{format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
            <span>{tryout.location}</span>
            {tryout.team && <Badge tone="play">{tryout.team.name}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tryout.team && signupsWithPlayers.length > 0 && (
            <BulkOfferButton
              teamId={tryout.team.id}
              teamName={tryout.team.name}
              clubId={params.id}
              recipients={signupsWithPlayers.map((s) => ({
                signupId: s.id,
                playerName: s.playerName,
                eligible: !!s.matchedPlayer && s.offers.length === 0 && s.status !== "CANCELLED",
                status:
                  s.offers.length > 0
                    ? `Offer ${s.offers[s.offers.length - 1].status.toLowerCase()}`
                    : s.status === "CANCELLED"
                      ? "Cancelled"
                      : !s.matchedPlayer
                        ? "No player profile"
                        : null,
              }))}
            />
          )}
          {signupsWithPlayers.length > 0 && (
            <Button
              href={`/clubs/${params.id}/tryouts/${params.tryoutId}/check-in`}
              variant="subtle"
              size="sm"
              icon={ICONS.check}
            >
              {`Check-in (${checkedInCount}/${signupsWithPlayers.length})`}
            </Button>
          )}
        </div>
      </div>

      {signupsWithPlayers.length === 0 ? (
        <div className="reveal border-ink-300 shadow-soft rounded-3xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-condensed text-ink-950 mb-2 text-xl font-bold uppercase tracking-wide">
            No signups yet
          </h3>
          <p className="text-ink-600">
            Once parents sign up their children, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white">
          <PanelHeader
            variant="band"
            title="Signups"
            action={
              <span className="text-ink-600 text-sm font-semibold">
                {signupsWithPlayers.length} signup{signupsWithPlayers.length !== 1 ? "s" : ""}
                {checkedInCount > 0 ? ` • ${checkedInCount} checked in` : ""}
              </span>
            }
          />
          {/* Phone shape (responsive-design-concept.md, Shape 1): cards with
              who/status/what-next; everything else opens per row. The full
              table stays for sm+ untouched. */}
          <div className="divide-ink-100 divide-y sm:hidden">
            {signupsWithPlayers.map((signup) => {
              const hasOffer = signup.offers.length > 0
              const latestOffer = signup.offers[signup.offers.length - 1]
              return (
                <details key={signup.id} className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="text-ink-900 flex items-center gap-1.5 font-medium">
                        {signup.playerName}
                        {signup.checkedInAt && (
                          <span className="bg-court-50 text-court-700 ring-court-100 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset">
                            ✓ in
                          </span>
                        )}
                      </div>
                      <div className="text-ink-500 truncate text-xs">
                        {signup.user.firstName} {signup.user.lastName}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={signup.status} offerStatus={latestOffer?.status} />
                      <span className="text-ink-400 transition-transform group-open:rotate-90">›</span>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <MobileField label="Parent">
                      {signup.user.firstName} {signup.user.lastName} · {signup.user.email}
                    </MobileField>
                    <MobileField label="Age / Gender">
                      {signup.playerAge} / {signup.playerGender}
                    </MobileField>
                    <MobileField label="Signed up">
                      {format(new Date(signup.createdAt), "MMM d, yyyy")}
                    </MobileField>
                    {signup.notes && <MobileField label="Notes">{signup.notes}</MobileField>}
                    <div className="pt-1.5">
                      <SignupAction
                        signup={signup}
                        hasOffer={hasOffer}
                        latestOffer={latestOffer}
                        tryout={tryout}
                        clubId={params.id}
                      />
                    </div>
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
                  <Th>Parent</Th>
                  <Th>Age / Gender</Th>
                  <Th>Status</Th>
                  <Th>Signed Up</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody className="divide-ink-100 divide-y">
                {signupsWithPlayers.map((signup) => {
                  const hasOffer = signup.offers.length > 0
                  const latestOffer = signup.offers[signup.offers.length - 1]

                  return (
                    <tr key={signup.id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-ink-900 flex items-center gap-1.5 font-medium">
                          {signup.playerName}
                          {signup.checkedInAt && (
                            <span
                              className="bg-court-50 text-court-700 ring-court-100 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                              title={`Checked in ${format(new Date(signup.checkedInAt), "h:mm a")}`}
                            >
                              ✓ in
                            </span>
                          )}
                        </div>
                        {signup.notes && (
                          <div className="text-ink-500 mt-0.5 text-xs">{signup.notes}</div>
                        )}
                      </td>
                      <td className="text-ink-600 whitespace-nowrap px-6 py-4 text-sm">
                        <div>
                          {signup.user.firstName} {signup.user.lastName}
                        </div>
                        <div className="text-ink-400 text-xs">{signup.user.email}</div>
                      </td>
                      <td className="text-ink-600 whitespace-nowrap px-6 py-4 text-sm">
                        {signup.playerAge} / {signup.playerGender}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusBadge status={signup.status} offerStatus={latestOffer?.status} />
                      </td>
                      <td className="text-ink-500 whitespace-nowrap px-6 py-4 text-sm">
                        {format(new Date(signup.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <SignupAction
                          signup={signup}
                          hasOffer={hasOffer}
                          latestOffer={latestOffer}
                          tryout={tryout}
                          clubId={params.id}
                        />
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

/** The one action a signup row offers — shared by the table and the cards. */
function SignupAction({
  signup,
  hasOffer,
  latestOffer,
  tryout,
  clubId,
}: {
  signup: any
  hasOffer: boolean
  latestOffer: any
  tryout: any
  clubId: string
}) {
  if (tryout.team && signup.matchedPlayer && !hasOffer) {
    return (
      <MakeOfferButton
        teamId={tryout.team.id}
        teamName={tryout.team.name}
        playerId={signup.matchedPlayer.id}
        playerName={signup.playerName}
        tryoutSignupId={signup.id}
        clubId={clubId}
      />
    )
  }
  if (hasOffer && latestOffer) {
    return <span className="text-ink-500 text-xs">Offer {latestOffer.status.toLowerCase()}</span>
  }
  if (tryout.team && !signup.matchedPlayer) {
    return <span className="text-ink-400 text-xs">No player profile matched</span>
  }
  return <span className="text-ink-400 text-xs">No team linked</span>
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

function StatusBadge({ status, offerStatus }: { status: string; offerStatus?: string }) {
  if (offerStatus) {
    return <Badge tone={toneForStatus(offerStatus)}>Offer {offerStatus.toLowerCase()}</Badge>
  }
  return <Badge tone={toneForStatus(status)}>{status.toLowerCase()}</Badge>
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
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path
        d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
        strokeLinejoin="round"
      />
      <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
