// Club Messages — re-engagement email composer over computed audiences
// (docs/season-continuity-plan.md §4). Access control: the clubs/[id] layout
// gates club membership; the comms APIs enforce ClubOwner/ClubManager on
// every request.

import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { MessageComposer } from "@/components/comms/message-composer"

export const dynamic = "force-dynamic"

export default async function ClubMessagesPage({ params }: { params: { id: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { name: true },
  })
  if (!tenant) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="reveal">
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Messages
        </h2>
        <p className="text-ink-500 mt-1 text-sm">
          Invite past families back — team rosters, camp and house-league registrants, or everyone
          who has engaged with {tenant.name}. Consent is enforced automatically on every send.
        </p>
      </div>
      <div className="reveal" style={{ animationDelay: "80ms" }}>
        <MessageComposer scope="TENANT" orgId={params.id} orgName={tenant.name} />
      </div>
    </div>
  )
}
