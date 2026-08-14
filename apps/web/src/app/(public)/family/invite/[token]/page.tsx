import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { CourtBackdrop } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * /family/invite/[token] — the public landing for an emailed family invite
 * (parent-child linking arc 2026-08-12).
 *
 * The promoted journey is a kid finding SportsHub first and inviting a parent
 * who has never had an account. Sending that parent to a bare sign-in screen
 * threw away the only thing that would make them sign up: knowing their kid
 * asked. So the ask is shown first, with the account step underneath and the
 * right email already in the box.
 *
 * Signed in already? Straight through to the accept page, which is where the
 * consent decision lives.
 */
export default async function FamilyInviteLandingPage({
  params,
}: {
  params: { token: string }
}) {
  const session = await getServerSession(authOptions).catch(() => null)
  if (session?.user?.id) {
    redirect(`/family/accept/${params.token}`)
  }

  const invite = await (prisma as any).familyInvitation.findUnique({
    where: { token: params.token },
    select: {
      type: true,
      status: true,
      expiresAt: true,
      invitedEmail: true,
      player: { select: { firstName: true, lastName: true } },
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const acceptPath = `/family/accept/${params.token}`
  const dead =
    !invite || invite.status !== "PENDING" || new Date(invite.expiresAt) < new Date()

  if (dead) {
    return (
      <CourtBackdrop
        variant="daylight"
        className="flex min-h-[calc(100vh-4rem)] items-center"
        contentClassName="mx-auto max-w-lg px-4 py-16"
      >
        <div className="border-ink-100 shadow-panel rounded-[30px] border bg-white p-8 text-center">
          <h1 className="text-ink-900 text-xl font-bold">
            {invite?.status === "ACCEPTED" ? "Already accepted" : "This invitation is closed"}
          </h1>
          <p className="text-ink-500 mt-2 text-sm">
            {invite?.status === "ACCEPTED"
              ? "This one was already used. Sign in and you'll find everything linked."
              : "Ask for a fresh invitation and you'll be linked in seconds."}
          </p>
          <Link
            href="/sign-in"
            className="bg-play-600 hover:bg-play-700 mt-6 inline-block rounded-xl px-5 py-2.5 font-semibold text-white transition-colors duration-200"
          >
            Sign in
          </Link>
        </div>
      </CourtBackdrop>
    )
  }

  const playerName = `${invite.player.firstName} ${invite.player.lastName}`
  const isChildLogin = invite.type === "CHILD_LOGIN"
  const inviterName =
    [invite.invitedBy.firstName, invite.invitedBy.lastName].filter(Boolean).join(" ") ||
    invite.invitedBy.email

  const signUpHref = `/sign-up?callbackUrl=${encodeURIComponent(acceptPath)}&email=${encodeURIComponent(invite.invitedEmail)}`
  const signInHref = `/sign-in?callbackUrl=${encodeURIComponent(acceptPath)}`

  return (
    <CourtBackdrop
      variant="daylight"
      className="flex min-h-[calc(100vh-4rem)] items-center"
      contentClassName="mx-auto max-w-lg px-4 py-16"
    >
      <div className="border-ink-100 shadow-panel rounded-[30px] border bg-white p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
          Family invitation
        </div>

        <h1 className="text-ink-950 text-2xl font-bold">
          {isChildLogin
            ? `${inviterName} set up your player profile`
            : `${invite.player.firstName} asked you to be their parent or guardian`}
        </h1>

        <p className="text-ink-600 mt-3 text-sm leading-relaxed">
          {isChildLogin ? (
            <>
              <strong>{playerName}</strong>&apos;s basketball profile is ready and waiting for you
              to sign in to it. You&apos;ll see your teams, games, stats, and schedule.
              Registrations and payments stay with {inviterName}.
            </>
          ) : (
            <>
              <strong>{playerName}</strong> plays basketball on SportsHub and asked you to be
              their parent or guardian. Once you&apos;re linked, you approve who follows them,
              register them for programs, and anything that costs money comes to you to approve
              and pay.
            </>
          )}
        </p>

        <div className="border-ink-100 bg-court-50/60 mt-6 rounded-2xl border p-4">
          <p className="text-ink-700 text-sm font-semibold">
            {isChildLogin ? "Two steps" : "Two steps and you're linked"}
          </p>
          <ol className="text-ink-600 mt-2 space-y-1 text-sm">
            <li>1. Create your account with {invite.invitedEmail}</li>
            <li>2. Tap accept and you&apos;re {isChildLogin ? "in" : "linked"}</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={signUpHref}
            className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-4 py-3 text-center font-semibold text-white transition-colors duration-200"
          >
            Create my account
          </Link>
          <Link
            href={signInHref}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-3 text-center font-semibold transition-colors duration-200"
          >
            I already have one
          </Link>
        </div>

        <p className="text-ink-400 mt-4 text-xs">
          Use {invite.invitedEmail} so we can match the invitation to your account.
        </p>
      </div>
    </CourtBackdrop>
  )
}
