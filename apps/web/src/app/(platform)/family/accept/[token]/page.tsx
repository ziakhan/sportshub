import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { findMergeCandidates } from "@/lib/family/claim-target"
import { AcceptFamilyInvite } from "./accept-family-invite"

export const dynamic = "force-dynamic"

/**
 * /family/accept/[token] — the landing page for CHILD_LOGIN, GUARDIAN and
 * CHILD_CLAIM invitations (family-accounts plan 2026-07-23; claim + merge
 * added by the parent-child linking arc 2026-08-12). Anonymous visitors
 * bounce through the public /family/invite landing, which explains the ask
 * before asking anyone to make an account.
 */
export default async function FamilyAcceptPage({ params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions).catch(() => null)
  if (!session?.user?.id) {
    redirect(`/family/invite/${params.token}`)
  }

  const invite = await (prisma as any).familyInvitation.findUnique({
    where: { token: params.token },
    include: {
      player: {
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
      },
      targetPlayer: { select: { firstName: true, lastName: true } },
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const playerName = invite ? `${invite.player.firstName} ${invite.player.lastName}` : ""
  const inviterName = invite
    ? [invite.invitedBy.firstName, invite.invitedBy.lastName].filter(Boolean).join(" ") ||
      invite.invitedBy.email
    : ""
  const expired = invite && invite.status === "PENDING" && new Date(invite.expiresAt) < new Date()

  // A parent accepting a guardian invite may already have a row for the same
  // kid. Offer the merge here rather than leaving two of them on the platform.
  const mergeCandidates =
    invite && invite.status === "PENDING" && !expired && invite.type === "GUARDIAN"
      ? await findMergeCandidates(session.user.id, invite.player)
      : []

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {!invite ? (
        <div className="border-ink-100 rounded-2xl border bg-white p-8 text-center">
          <h1 className="text-ink-900 text-xl font-bold">Invitation not found</h1>
          <p className="text-ink-500 mt-2 text-sm">
            The link may be incomplete. Try opening it again from the email.
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
          playerFirstName={invite.player.firstName}
          inviterName={inviterName}
          invitedEmail={invite.invitedEmail}
          targetPlayerName={
            invite.targetPlayer
              ? `${invite.targetPlayer.firstName} ${invite.targetPlayer.lastName}`
              : null
          }
          mergeCandidates={mergeCandidates.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
          }))}
        />
      )}
    </div>
  )
}
