import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { CheckInList } from "./check-in-list"

export default async function TryoutCheckInPage({
  params,
}: {
  params: { id: string; tryoutId: string }
}) {
  const tryout = await prisma.tryout.findFirst({
    where: { id: params.tryoutId, tenantId: params.id },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      location: true,
      team: { select: { name: true } },
      signups: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          playerName: true,
          playerAge: true,
          playerGender: true,
          status: true,
          checkedInAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { playerName: "asc" },
      },
    },
  })

  if (!tryout) {
    return (
      <div className="border-hoop-200 bg-hoop-50 rounded-xl border p-6 text-center">
        <p className="text-hoop-700">Tryout not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Link
          href={`/clubs/${params.id}/tryouts/${params.tryoutId}/signups`}
          className="text-play-700 text-sm hover:underline"
        >
          &larr; Back to Signups
        </Link>
      </div>

      <div className="mb-4">
        <h2 className="text-ink-900 text-xl font-bold">{tryout.title} — Check-in</h2>
        <p className="text-ink-500 mt-1 text-sm">
          {format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
          {" • "}
          {tryout.location}
          {tryout.team ? ` • ${tryout.team.name}` : ""}
        </p>
      </div>

      <CheckInList
        tryoutId={tryout.id}
        signups={tryout.signups.map((s: (typeof tryout.signups)[number]) => ({
          id: s.id,
          playerName: s.playerName,
          playerAge: s.playerAge,
          playerGender: s.playerGender,
          status: s.status,
          checkedInAt: s.checkedInAt ? s.checkedInAt.toISOString() : null,
          parentName: [s.user.firstName, s.user.lastName].filter(Boolean).join(" "),
        }))}
      />
    </div>
  )
}
