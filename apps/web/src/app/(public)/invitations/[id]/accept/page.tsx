import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { AcceptInviteActions } from "./accept-invite-actions"

export const dynamic = "force-dynamic"

export default async function AcceptInvitationPage({
  params,
}: {
  params: { id: string }
}) {
  const invitation = await prisma.staffInvitation.findUnique({
    where: { id: params.id },
    include: {
      tenant: { select: { name: true } },
      invitedBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!invitation) notFound()

  const team = invitation.teamId
    ? await prisma.team.findUnique({
        where: { id: invitation.teamId },
        select: { name: true },
      })
    : null

  const session = await getServerSession(authOptions)
  const callbackUrl = `/invitations/${invitation.id}/accept`
  const inviterName = [invitation.invitedBy?.firstName, invitation.invitedBy?.lastName]
    .filter(Boolean)
    .join(" ") || "A club admin"

  const cardClass =
    "border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"

  // Already responded — show summary, no actions
  if (invitation.status !== "PENDING") {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12">
        <div className={cardClass}>
          <h1 className="text-ink-900 mb-2 text-2xl font-semibold">
            Invitation {invitation.status.toLowerCase()}
          </h1>
          <p className="text-ink-600 text-sm">
            This invitation has already been {invitation.status.toLowerCase()}. If you
            think this is a mistake, contact {invitation.tenant.name}.
          </p>
        </div>
      </div>
    )
  }

  // Not signed in — prompt sign-in or sign-up, both redirect back here
  if (!session?.user?.id) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12">
        <div className={cardClass}>
          <h1 className="text-ink-900 mb-1 text-2xl font-semibold">
            You&apos;re invited to join {invitation.tenant.name}
          </h1>
          <p className="text-ink-600 mb-2 text-sm">
            {inviterName} invited <strong>{invitation.invitedEmail}</strong> to join as{" "}
            <strong>{invitation.role}</strong>
            {team ? <> on team <strong>{team.name}</strong></> : null}.
          </p>
          <p className="text-ink-700 mb-6 mt-4 text-sm">
            Sign in or create an account using <strong>{invitation.invitedEmail}</strong> to accept.
          </p>
          <div className="flex gap-3">
            <Link
              href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-4 py-2 text-center font-semibold text-white transition"
            >
              Sign in
            </Link>
            <Link
              href={`/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="border-ink-200 text-ink-700 hover:bg-court-50 flex-1 rounded-xl border px-4 py-2 text-center font-semibold transition"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Signed-in but as a different user than the invitee
  if (invitation.invitedUserId && invitation.invitedUserId !== session.user.id) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12">
        <div className={cardClass}>
          <h1 className="text-ink-900 mb-2 text-2xl font-semibold">Wrong account</h1>
          <p className="text-ink-600 mb-4 text-sm">
            This invitation was sent to <strong>{invitation.invitedEmail}</strong>. You
            are signed in as a different user. Sign out and sign in with that email to
            accept.
          </p>
          <Link
            href={`/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="border-ink-200 text-ink-700 hover:bg-court-50 inline-block rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            Sign out
          </Link>
        </div>
      </div>
    )
  }

  // Signed in as the right user (or as a fresh user post-signup with invitedUserId still null —
  // signup should have attached it via Gap 0.1.1 fix). Render action form.
  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <div className={cardClass}>
        <h1 className="text-ink-900 mb-1 text-2xl font-semibold">
          Join {invitation.tenant.name}
        </h1>
        <p className="text-ink-600 mb-6 text-sm">
          {inviterName} invited you to join as <strong>{invitation.role}</strong>
          {team ? <> on team <strong>{team.name}</strong></> : null}.
        </p>
        <AcceptInviteActions invitationId={invitation.id} />
      </div>
    </div>
  )
}
