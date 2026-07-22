"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/components/ui/cn"
import type { FeedItem } from "@/lib/queries/feed"

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "🏀"] as const

interface CommentRow {
  id: string
  body: string
  createdAt: string
  mine: boolean
  authorName: string
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/**
 * One feed post (social-feed-plan P5): system score cards, player stat/POTG
 * cards, org photo/video posts, recaps — with reactions, text comments
 * (report → auto-hide moderation), reposts (PUBLIC only), share-to-chat and
 * the native share sheet.
 */
export function FeedCard({ item }: { item: FeedItem }) {
  const [reactionCount, setReactionCount] = useState(item.counts.reactions)
  const [myEmojis, setMyEmojis] = useState<string[]>(item.myEmojis)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [commentCount, setCommentCount] = useState(item.counts.comments)
  const [draft, setDraft] = useState("")
  const [reposted, setReposted] = useState(item.myRepost)
  const [repostCount, setRepostCount] = useState(item.counts.reposts)
  const [sendOpen, setSendOpen] = useState(false)
  const [teams, setTeams] = useState<Array<{ id: string; name: string }> | null>(null)
  const [sent, setSent] = useState(false)

  const href =
    item.kind === "STAT_CARD" || item.kind === "PLAYER_OF_GAME" || item.kind === "ANNOUNCEMENT"
      ? item.gameId
        ? `/live/${item.gameId}`
        : `/news/${item.slug}`
      : `/news/${item.slug}`

  const react = async (emoji: string) => {
    setPickerOpen(false)
    const had = myEmojis.includes(emoji)
    setMyEmojis((m) => (had ? m.filter((e) => e !== emoji) : [...m, emoji]))
    setReactionCount((c) => c + (had ? -1 : 1))
    try {
      const res = await fetch(`/api/posts/${item.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      })
      if (res.ok) {
        const data = await res.json()
        setMyEmojis(data.mine)
        setReactionCount(
          data.reactions.reduce((s: number, r: { count: number }) => s + r.count, 0)
        )
      }
    } catch {
      /* optimistic state stands */
    }
  }

  const openComments = async () => {
    setCommentsOpen((o) => !o)
    if (comments === null) {
      try {
        const res = await fetch(`/api/posts/${item.id}/comments`)
        if (res.ok) setComments((await res.json()).comments)
      } catch {
        setComments([])
      }
    }
  }

  const addComment = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft("")
    try {
      const res = await fetch(`/api/posts/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        const data = await res.json()
        setComments((c) => [...(c ?? []), data.comment])
        setCommentCount((n) => n + 1)
      }
    } catch {
      /* dropped comment shows on next open */
    }
  }

  const removeComment = async (id: string) => {
    setComments((c) => c?.filter((x) => x.id !== id) ?? null)
    setCommentCount((n) => Math.max(0, n - 1))
    await fetch(`/api/comments/${id}`, { method: "DELETE" })
  }

  const reportComment = async (id: string) => {
    await fetch(`/api/comments/${id}/report`, { method: "POST" })
    setComments((c) => c?.filter((x) => x.id !== id) ?? null)
  }

  const toggleRepost = async () => {
    const next = !reposted
    setReposted(next)
    setRepostCount((c) => c + (next ? 1 : -1))
    const res = await fetch(`/api/posts/${item.id}/repost`, { method: next ? "POST" : "DELETE" })
    if (!res.ok) {
      setReposted(!next)
      setRepostCount((c) => c + (next ? -1 : 1))
    }
  }

  const openSend = async () => {
    setSendOpen((o) => !o)
    setSent(false)
    if (teams === null) {
      try {
        const res = await fetch("/api/chat/teams")
        if (res.ok) setTeams((await res.json()).teams)
      } catch {
        setTeams([])
      }
    }
  }

  const sendToTeam = async (teamId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: `${item.title} — ${window.location.origin}${href}`,
          sharedPostId: item.id,
        }),
      })
      if (res.ok) setSent(true)
    } catch {
      /* leave picker open */
    }
  }

  return (
    <article className="border-ink-100 shadow-soft rounded-2xl border bg-white">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="min-w-0">
          {item.repostedBy && (
            <p className="text-ink-400 text-xs font-semibold">🔁 {item.repostedBy} reposted</p>
          )}
          <p className="text-ink-500 truncate text-xs font-medium">
            {item.authorName ?? "SportsHub One"} · {timeAgo(item.repostedAt ?? item.publishedAt)}
            {item.visibility === "FOLLOWERS" ? " · Followers" : ""}
          </p>
        </div>
      </div>

      <Link href={href} className="block px-4 pt-1.5">
        <h3 className="text-ink-950 text-[15px] font-bold leading-snug">{item.title}</h3>
        {item.body && item.kind !== "STAT_CARD" && item.kind !== "PLAYER_OF_GAME" && (
          <p className="text-ink-600 mt-1 line-clamp-3 text-sm">{item.body}</p>
        )}
      </Link>

      {(item.cardImage || (item.mediaUrl && item.mediaType === "IMAGE")) && (
        <Link href={href} className="mt-2.5 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.cardImage ?? item.mediaUrl!}
            alt=""
            className="max-h-[420px] w-full object-cover"
          />
        </Link>
      )}
      {item.mediaUrl && item.mediaType === "VIDEO_EMBED" && (
        <a
          href={item.mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="border-ink-100 bg-ink-50 text-play-700 mx-4 mt-2.5 block rounded-xl border p-3 text-sm font-semibold"
        >
          ▶ Watch video
        </a>
      )}

      <div className="text-ink-500 flex items-center gap-1 px-2 py-1.5 text-xs font-semibold">
        <span className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className={cn(
              "hover:bg-ink-50 flex items-center gap-1.5 rounded-full px-3 py-2",
              myEmojis.length > 0 && "text-play-700"
            )}
          >
            {myEmojis.length > 0 ? myEmojis.join("") : "👍"} {reactionCount > 0 ? reactionCount : "Like"}
          </button>
          {pickerOpen && (
            <span className="border-ink-100 absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-full border bg-white px-2 py-1.5 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => react(e)}
                  className={cn(
                    "rounded-full px-1 text-lg hover:scale-125",
                    myEmojis.includes(e) && "bg-play-50"
                  )}
                >
                  {e}
                </button>
              ))}
            </span>
          )}
        </span>
        <button onClick={openComments} className="hover:bg-ink-50 rounded-full px-3 py-2">
          💬 {commentCount > 0 ? commentCount : "Comment"}
        </button>
        {item.visibility === "PUBLIC" && (
          <button
            onClick={toggleRepost}
            className={cn("hover:bg-ink-50 rounded-full px-3 py-2", reposted && "text-court-700")}
          >
            🔁 {repostCount > 0 ? repostCount : "Repost"}
          </button>
        )}
        {item.visibility === "PUBLIC" && (
          <button onClick={openSend} className="hover:bg-ink-50 rounded-full px-3 py-2">
            📤 Send
          </button>
        )}
      </div>

      {sendOpen && (
        <div className="border-ink-100 mx-4 mb-3 rounded-xl border p-3">
          {sent ? (
            <p className="text-court-700 text-xs font-semibold">Sent to the team chat.</p>
          ) : teams === null ? (
            <p className="text-ink-500 text-xs">Loading your chats…</p>
          ) : teams.length === 0 ? (
            <p className="text-ink-500 text-xs">No team chats yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => sendToTeam(t.id)}
                  className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {commentsOpen && (
        <div className="border-ink-100 border-t px-4 py-3">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="group flex items-start gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-ink-800 text-sm">
                  <span className="font-semibold">{c.authorName}</span> {c.body}
                </p>
              </div>
              {c.mine ? (
                <button
                  onClick={() => removeComment(c.id)}
                  className="text-ink-300 hover:text-ink-600 text-xs opacity-0 group-hover:opacity-100"
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={() => reportComment(c.id)}
                  className="text-ink-300 hover:text-hoop-600 text-xs opacity-0 group-hover:opacity-100"
                >
                  Report
                </button>
              )}
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Add a comment…"
              maxLength={1000}
              className="border-ink-200 flex-1 rounded-full border px-3.5 py-2 text-sm"
            />
            <button
              onClick={addComment}
              disabled={!draft.trim()}
              className="bg-play-600 hover:bg-play-700 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
