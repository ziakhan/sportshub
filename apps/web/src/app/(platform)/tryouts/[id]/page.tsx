import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"
import { SignupForm } from "./signup-form"
import { formatCurrency } from "@/lib/countries"

async function getTryout(id: string) {
  const tryout = await prisma.tryout.findUnique({
    where: { id },
    include: {
      tenant: {
        include: {
          branding: true,
        },
      },
      _count: {
        select: {
          signups: {
            where: { status: { not: "CANCELLED" } },
          },
        },
      },
    },
  })

  if (!tryout || !tryout.isPublished) return null
  return { ...tryout, fee: Number(tryout.fee) }
}

async function getUserData(userId: string | null, tryoutId: string) {
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) return null

  const [players, existingSignups] = await Promise.all([
    prisma.player.findMany({
      where: { parentId: user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
      },
      orderBy: { firstName: "asc" },
    }),
    prisma.tryoutSignup.findMany({
      where: {
        tryoutId,
        userId: user.id,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        playerName: true,
        status: true,
      },
    }),
  ])

  return { players, existingSignups }
}

export default async function TryoutDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const tryout = await getTryout(params.id)
  if (!tryout) notFound()

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const userData = await getUserData(userId, params.id)

  const isPast = new Date(tryout.scheduledAt) < new Date()
  const isFull =
    tryout.maxParticipants !== null &&
    tryout._count.signups >= tryout.maxParticipants
  const fee = Number(tryout.fee)
  const currency = tryout.tenant.currency || "USD"
  const spotsLeft = tryout.maxParticipants
    ? tryout.maxParticipants - tryout._count.signups
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Club header */}
      <div
        className="border-b"
        style={{
          backgroundColor:
            tryout.tenant.branding?.primaryColor || "#1a73e8",
        }}
      >
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/marketplace"
            className="mb-2 inline-block text-sm text-white/80 hover:text-white"
          >
            &larr; Back to Marketplace
          </Link>
          <h2 className="text-lg font-semibold text-white">
            {tryout.tenant.name}
          </h2>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-8 shadow">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {isPast && (
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                    Closed
                  </span>
                )}
                {isFull && !isPast && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    Full
                  </span>
                )}
                {!isPast && !isFull && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Open
                  </span>
                )}
              </div>

              <h1 className="mb-4 text-3xl font-bold text-gray-900">
                {tryout.title}
              </h1>

              {tryout.description && (
                <p className="mb-6 text-gray-700">{tryout.description}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="mb-1 text-sm font-medium text-gray-500">
                    Date & Time
                  </div>
                  <div className="text-gray-900">
                    {format(
                      new Date(tryout.scheduledAt),
                      "EEEE, MMMM d, yyyy"
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {format(new Date(tryout.scheduledAt), "h:mm a")}
                    {tryout.duration && ` (${tryout.duration} min)`}
                  </div>
                </div>

                <div className="rounded-md bg-gray-50 p-4">
                  <div className="mb-1 text-sm font-medium text-gray-500">
                    Location
                  </div>
                  <div className="text-gray-900">{tryout.location}</div>
                </div>

                <div className="rounded-md bg-gray-50 p-4">
                  <div className="mb-1 text-sm font-medium text-gray-500">
                    Age Group & Gender
                  </div>
                  <div className="text-gray-900">
                    {tryout.ageGroup}
                    {tryout.gender ? ` \u2022 ${tryout.gender}` : ""}
                  </div>
                </div>

                <div className="rounded-md bg-gray-50 p-4">
                  <div className="mb-1 text-sm font-medium text-gray-500">
                    Spots
                  </div>
                  <div className="text-gray-900">
                    {tryout._count.signups} signed up
                    {spotsLeft !== null && (
                      <span className="text-sm text-gray-500">
                        {" "}
                        ({spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar — signup */}
          <div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {fee === 0 ? "FREE" : formatCurrency(fee, currency)}
                </div>
                {fee > 0 && (
                  <p className="mt-1 text-xs text-gray-500">per player</p>
                )}
              </div>

              {isPast ? (
                <div className="rounded-md bg-gray-100 p-4 text-center text-sm text-gray-600">
                  This tryout has already taken place.
                </div>
              ) : isFull ? (
                <div className="rounded-md bg-red-50 p-4 text-center text-sm text-red-600">
                  This tryout is full. Check back for future openings.
                </div>
              ) : !userId ? (
                <div className="text-center">
                  <p className="mb-4 text-sm text-gray-600">
                    Sign in to register your player for this tryout.
                  </p>
                  <Link
                    href={`/sign-in?redirect_url=/tryouts/${params.id}`}
                    className="inline-block w-full rounded-md bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
                  >
                    Sign In to Sign Up
                  </Link>
                </div>
              ) : (
                <SignupForm
                  tryoutId={params.id}
                  tryoutFee={fee}
                  tryoutLocation={tryout.location}
                  tryoutDate={format(
                    new Date(tryout.scheduledAt),
                    "MMM d, yyyy 'at' h:mm a"
                  )}
                  players={userData?.players || []}
                  existingSignups={userData?.existingSignups || []}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
