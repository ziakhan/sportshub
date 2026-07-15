import Link from "next/link"
import { redirect } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatTeamSummaries } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

export const metadata = { title: "Chat" }

/**
 * /messages — the one conversation list (site-ia-plan §5.6.7): every team
 * chat this person belongs to for ANY reason (coaching, kids on the roster,
 * club staff), unread-first. The Chat tab/icon lands here; rows open the
 * full team chat. Never guesses which hat you're wearing — the list is the
 * disambiguation.
 */
export default async function MessagesPage() {
  const auth = await getSessionUserId()
  if (!auth) redirect("/sign-in?callbackUrl=/messages")

  const summaries = await getChatTeamSummaries(auth.userId)

  // Direct messages (2026-07-15) — 1:1 threads beside the team channels
  const dmRows = await (prisma as any).conversation.findMany({
    where: { participants: { some: { userId: auth.userId } } },
    select: {
      id: true,
      updatedAt: true,
      team: { select: { name: true } },
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, senderId: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  })
  const dms = await Promise.all(
    dmRows.map(async (c: any) => {
      const me = c.participants.find((p: any) => p.userId === auth.userId)
      const other = c.participants.find((p: any) => p.userId !== auth.userId)
      const unread = await (prisma as any).directMessage.count({
        where: {
          conversationId: c.id,
          deletedAt: null,
          senderId: { not: auth.userId },
          ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      })
      return {
        id: c.id,
        name:
          [other?.user?.firstName, other?.user?.lastName].filter(Boolean).join(" ") || "Member",
        teamName: c.team?.name ?? null,
        preview: c.messages[0] ?? null,
        unread,
      }
    })
  )

  const previews = summaries.length
    ? await prisma.teamMessage.findMany({
        where: { teamId: { in: summaries.map((s) => s.teamId) }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        distinct: ["teamId"],
        select: {
          teamId: true,
          body: true,
          createdAt: true,
          sender: { select: { firstName: true } },
        },
      })
    : []
  const previewByTeam = new Map(previews.map((p: any) => [p.teamId, p]))

  const rows = summaries
    .map((s) => ({ ...s, preview: previewByTeam.get(s.teamId) as any }))
    .sort((a, b) => {
      if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return b.unread > 0 ? 1 : -1
      const at = a.preview?.createdAt?.getTime() ?? 0
      const bt = b.preview?.createdAt?.getTime() ?? 0
      return bt - at
    })

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-ink-950 font-display text-2xl font-bold">Chat</h1>
      <p className="text-ink-500 mt-1 text-sm">Every team conversation you&apos;re part of.</p>

      {dms.length > 0 && (
        <div className="mt-6">
          <h2 className="text-ink-400 mb-2 px-1 text-xs font-bold uppercase tracking-wider">
            Direct messages
          </h2>
          <div className="border-ink-100 divide-y divide-ink-50 overflow-hidden rounded-2xl border bg-white">
            {dms.map((dm) => (
              <Link
                key={dm.id}
                href={`/messages/dm/${dm.id}`}
                className="hover:bg-ink-50 flex min-h-[64px] items-center gap-3 px-4 py-3 transition"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    dm.unread > 0 ? "bg-play-600 text-white" : "bg-ink-100 text-ink-600"
                  }`}
                >
                  {dm.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-ink-950 truncate text-sm font-semibold">
                      {dm.name}
                      {dm.teamName && (
                        <span className="text-ink-400 font-normal"> · {dm.teamName}</span>
                      )}
                    </span>
                    {dm.preview && (
                      <span className="text-ink-400 shrink-0 text-xs">
                        {formatDistanceToNow(new Date(dm.preview.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-ink-500 truncate text-xs">
                      {dm.preview ? dm.preview.body : "New conversation"}
                    </span>
                    {dm.unread > 0 && (
                      <span className="bg-hoop-600 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                        {dm.unread > 9 ? "9+" : dm.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {dms.length > 0 && rows.length > 0 && (
        <h2 className="text-ink-400 mb-2 mt-6 px-1 text-xs font-bold uppercase tracking-wider">
          Team chats
        </h2>
      )}

      {rows.length === 0 ? (
        <div className="border-ink-100 mt-6 rounded-2xl border bg-white p-8 text-center">
          <p className="text-ink-700 font-medium">No team chats yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            Chats appear here once you&apos;re on a team — as a coach, or with a kid on the roster.
          </p>
        </div>
      ) : (
        <div className="border-ink-100 mt-6 divide-y divide-ink-50 overflow-hidden rounded-2xl border bg-white">
          {rows.map((row) => (
            <Link
              key={row.teamId}
              href={`/teams/${row.teamId}/chat`}
              className="hover:bg-ink-50 flex min-h-[64px] items-center gap-3 px-4 py-3 transition"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  row.unread > 0 ? "bg-play-600 text-white" : "bg-ink-100 text-ink-600"
                }`}
              >
                {row.teamName.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-950 truncate text-sm font-semibold">{row.teamName}</span>
                  {row.preview && (
                    <span className="text-ink-400 shrink-0 text-xs">
                      {formatDistanceToNow(new Date(row.preview.createdAt), { addSuffix: true })}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-ink-500 truncate text-xs">
                    {row.preview
                      ? `${row.preview.sender?.firstName ?? "Someone"}: ${row.preview.body}`
                      : row.clubName}
                  </span>
                  {row.unread > 0 && (
                    <span className="bg-hoop-600 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                      {row.unread > 9 ? "9+" : row.unread}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
