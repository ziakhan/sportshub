import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { PublishButton } from "./publish-button"

async function getTryouts(tenantId: string) {
  return await prisma.tryout.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      location: true,
      ageGroup: true,
      isPublished: true,
      maxParticipants: true,
      team: {
        select: { id: true, name: true },
      },
      _count: {
        select: { signups: true },
      },
    },
    orderBy: { scheduledAt: "desc" },
  })
}

export default async function ClubTryoutsPage({
  params,
}: {
  params: { id: string }
}) {
  const tryouts = await getTryouts(params.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Tryouts</h2>
        <Link
          href={`/clubs/${params.id}/tryouts/create`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Create Tryout
        </Link>
      </div>

      {tryouts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tryouts yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create a tryout and publish it to the marketplace so parents can
            sign up.
          </p>
          <Link
            href={`/clubs/${params.id}/tryouts/create`}
            className="inline-block rounded-md bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700"
          >
            Create Your First Tryout
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tryouts.map((tryout) => {
            const isPast = new Date(tryout.scheduledAt) < new Date()

            return (
              <div
                key={tryout.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {tryout.title}
                      </h3>
                      {isPast ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Past
                        </span>
                      ) : tryout.isPublished ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Draft
                        </span>
                      )}
                      {tryout.team && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          {tryout.team.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>
                        {format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <span>{tryout.location}</span>
                      <span>{tryout.ageGroup}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {tryout._count.signups}
                        {tryout.maxParticipants
                          ? ` / ${tryout.maxParticipants}`
                          : ""}
                      </div>
                      <div className="text-xs text-gray-500">signups</div>
                    </div>
                    <Link
                      href={`/clubs/${params.id}/tryouts/${tryout.id}/signups`}
                      className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Signups
                    </Link>
                    <Link
                      href={`/clubs/${params.id}/tryouts/${tryout.id}/edit`}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    {!isPast && (
                      <PublishButton
                        tryoutId={tryout.id}
                        isPublished={tryout.isPublished}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
