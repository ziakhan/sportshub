import { prisma } from "@youthbasketballhub/db"
import { notifyBatch } from "@/lib/notifications"

/**
 * Attach a brand-new account to family invitations already waiting on its
 * email address (parent-child linking arc 2026-08-12).
 *
 * The primary promoted journey is a kid inviting a parent who has never had
 * an account: the parent taps the emailed link, signs up, and the invite has
 * to be sitting there the moment they land. This used to live inline in the
 * password-signup route only, so a parent who signed up with Google fell
 * through the floor: account created, invite still orphaned, no bell, no
 * prompt. One helper, called from every path that mints a user.
 *
 * Stamping `invitedUserId` is deliberately not accepting: attaching a
 * guardian is a consent decision, so it still takes the parent's own tap on
 * the accept page. What this guarantees is that they can find it.
 */
export async function attachPendingFamilyInvitations(
  userId: string,
  email: string
): Promise<number> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return 0

  const pending = await (prisma as any).familyInvitation.findMany({
    where: {
      invitedEmail: { equals: normalized, mode: "insensitive" },
      invitedUserId: null,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      type: true,
      token: true,
      player: { select: { firstName: true, lastName: true } },
    },
  })
  if (pending.length === 0) return 0

  await (prisma as any).familyInvitation.updateMany({
    where: { id: { in: pending.map((i: any) => i.id) } },
    data: { invitedUserId: userId },
  })

  await notifyBatch(
    prisma,
    pending.map((inv: any) => {
      const name = `${inv.player.firstName} ${inv.player.lastName}`
      return {
        userId,
        type: "family_invite" as const,
        title:
          inv.type === "CHILD_LOGIN"
            ? "Your player login is waiting"
            : inv.type === "CHILD_CLAIM"
              ? `${inv.player.firstName} asked to link their login`
              : "Guardian invitation",
        message:
          inv.type === "CHILD_LOGIN"
            ? `You've been invited to take over ${name}'s player profile.`
            : inv.type === "CHILD_CLAIM"
              ? `${name} says you already set up their profile and asked to sign in to it.`
              : `${name} asked you to become their parent/guardian on SportsHub.`,
        link: `/family/accept/${inv.token}`,
        referenceId: inv.id,
        referenceType: "FamilyInvitation",
      }
    })
  )

  return pending.length
}
