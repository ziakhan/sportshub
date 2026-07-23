import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { AcceptFamilyInvite } from "./accept-family-invite"

export const dynamic = "force-dynamic"

/**
 * /family/accept/[token] — the landing page for CHILD_LOGIN and GUARDIAN
 * invitations (family-accounts plan 2026-07-23). Anonymous visitors bounce
 * through sign-in/sign-up with this URL as the callback; the emailed invite
 * tells them to use the invited email address.
 */
export default async function FamilyAcceptPage({ params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions).catch(() => null)
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/family/accept/${params.token}`)}`)
  }

  const invite = await (prisma as any).familyInvitation.findUnique({
    where: { token: params.token },
    include: {
      player: { select: { firstName: true, lastName: true } },
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const playerName = invite ? `${invite.player.firstName} ${invite.player.lastName}` : ""
  const inviterName = invite
    ? [invite.invitedBy.firstName, invite.invitedBy.lastName].filter(Boolean).join(" ") ||
      invite.invitedBy.email
    : ""
  const expired = invite && invite.status === "PENDING" && new Date(invite.expiresAt) < new Date()

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {!invite ? (
        <div className="border-ink-100 rounded-2xl border bg-white p-8 text-center">
          <h1 className="text-ink-900 text-xl font-bold">Invitation not found</h1>
          <p className="text-ink-500 mt-2 text-sm">
            The link may be incomplete — try opening it again from the email.
          </p>
        </div>
      ) : invite.status !== "PENDING" || expired ? (
        <div className="border-ink-100 rounded-2xl border bg-white p-8 text-center">
          <h1 className="text-ink-900 text-xl font-bold">
            {invite.status === "ACCEPTED" ? "Already accepted" : expired ? "Invitation expired" : "Invitation closed"}
          </h1>
          <p className="text-ink-500 mt-2 text-sm">
            {invite.status === "ACCEPTED"
              ? "This invitation was already used. You're all set."
              : "Ask for a fresh invitation and you'll be linked in seconds."}
          </p>
        </div>
      ) : (
        <AcceptFamilyInvite
          token={params.token}
          type={invite.type}
          playerName={playerName}
          inviterName={inviterName}
          invitedEmail={invite.invitedEmail}
        />
      )}
    </div>
  )
}
