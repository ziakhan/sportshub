import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Badge, Card } from "@/components/ui"

async function getTryout(id: string) {
  const tryout = await prisma.tryout.findUnique({
    where: { id },
    include: {
      tenant: { include: { branding: true } },
      team: { select: { name: true, ageGroup: true, gender: true } },
      _count: {
        select: { signups: { where: { status: { not: "CANCELLED" } } } },
      },
    },
  })
  if (!tryout || !tryout.isPublished) return null
  return { ...tryout, fee: Number(tryout.fee) }
}

export default async function PublicTryoutDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const tryout = await getTryout(params.id)
  if (!tryout) notFound()

  const session = await getServerSession(authOptions)
  const isPast = new Date(tryout.scheduledAt) < new Date()
  const isFull = tryout.maxParticipants !== null && tryout._count.signups >= tryout.maxParticipants
  const fee = tryout.fee
  const currency = tryout.tenant.currency || "CAD"
  const spotsLeft = tryout.maxParticipants ? tryout.maxParticipants - tryout._count.signups : null

  return (
    <>
      {/* Club header */}
      <div
        className="border-b"
        style={{ backgroundColor: tryout.tenant.branding?.primaryColor || "#1a73e8" }}
      >
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/marketplace"
            className="mb-2 inline-block text-sm text-white/80 hover:text-white"
          >
            &larr; Back to Marketplace
          </Link>
          <Link href={`/club/${tryout.tenant.slug}`} className="block">
            <h2 className="text-lg font-semibold text-white hover:text-white/90">
              {tryout.tenant.name}
            </h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {isPast && <Badge tone="neutral">Closed</Badge>}
                {isFull && !isPast && <Badge tone="danger">Full</Badge>}
                {!isPast && !isFull && <Badge tone="court">Open</Badge>}
              </div>

              <h1 className="mb-4 text-3xl font-bold text-ink-950">{tryout.title}</h1>

              {tryout.description && (
                <p className="mb-6 text-ink-700">{tryout.description}</p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="mb-1 text-sm font-medium text-ink-500">Date &amp; Time</div>
                  <div className="text-ink-950">{format(new Date(tryout.scheduledAt), "EEEE, MMMM d, yyyy")}</div>
                  <div className="text-sm text-ink-600">
                    {format(new Date(tryout.scheduledAt), "h:mm a")}
                    {tryout.duration && ` (${tryout.duration} min)`}
                  </div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="mb-1 text-sm font-medium text-ink-500">Location</div>
                  <div className="text-ink-950">{tryout.location}</div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="mb-1 text-sm font-medium text-ink-500">Age Group &amp; Gender</div>
                  <div className="text-ink-950">
                    {tryout.ageGroup}{tryout.gender ? ` • ${tryout.gender}` : ""}
                  </div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="mb-1 text-sm font-medium text-ink-500">Spots</div>
                  <div className="text-ink-950">
                    {tryout._count.signups} signed up
                    {spotsLeft !== null && (
                      <span className="text-sm text-ink-500"> ({spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left)</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div>
            <Card>
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-hoop-600">
                  {fee === 0 ? "FREE" : formatCurrency(fee, currency)}
                </div>
                {fee > 0 && <p className="mt-1 text-xs text-ink-500">per player</p>}
              </div>

              {isPast ? (
                <div className="rounded-2xl bg-ink-100 p-4 text-center text-sm text-ink-600">
                  This tryout has already taken place.
                </div>
              ) : isFull ? (
                <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">
                  This tryout is full.
                </div>
              ) : session ? (
                <Link
                  href={`/tryouts/${params.id}`}
                  className="block w-full rounded-xl bg-play-600 px-4 py-3 text-center font-semibold text-white hover:bg-play-700"
                >
                  Sign Up Now
                </Link>
              ) : (
                <div className="text-center">
                  <p className="mb-4 text-sm text-ink-600">
                    Sign in to register your player for this tryout.
                  </p>
                  <Link
                    href={`/sign-in?callbackUrl=/tryouts/${params.id}`}
                    className="block w-full rounded-xl bg-play-600 px-4 py-3 text-center font-semibold text-white hover:bg-play-700"
                  >
                    Sign In to Sign Up
                  </Link>
                </div>
              )}
            </Card>

            {/* Club link */}
            <Card className="mt-4 text-center">
              <Link
                href={`/club/${tryout.tenant.slug}`}
                className="text-hoop-600 font-semibold hover:underline"
              >
                View {tryout.tenant.name} Profile &rarr;
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
