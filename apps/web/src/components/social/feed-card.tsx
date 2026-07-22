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

function Ic({ d, className, filled }: { d: string; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[18px] w-[18px]"}
    >
      <path d={d} />
    </svg>
  )
}
const IC = {
  heart: "M19 14c1.5-1.4 3-3.1 3-5.3A4.7 4.7 0 0 0 17.3 4c-1.6 0-3 .8-4.2 2.1a1.5 1.5 0 0 1-2.2 0C9.7 4.8 8.3 4 6.7 4A4.7 4.7 0 0 0 2 8.7c0 2.2 1.5 3.9 3 5.3l6.3 6a1 1 0 0 0 1.4 0Z",
  chat: "M21 12a8 8 0 0 1-8 8H4l2.4-2.4A8 8 0 1 1 21 12Z",
  repeat: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
}

const KIND_CHIP: Record<string, { label: string; cls: string }> = {
  PLAYER_OF_GAME: { label: "🏀 Player of the Game", cls: "bg-gold-50 text-gold-700 ring-gold-200" },
  STAT_CARD: { label: "📊 Game stats", cls: "bg-play-50 text-play-700 ring-play-200" },
  RECAP_AI: { label: "📰 Recap", cls: "bg-ink-50 text-ink-600 ring-ink-200" },
  ANNOUNCEMENT: { label: "📣 Announcement", cls: "bg-court-50 text-court-700 ring-court-200" },
  ARTICLE: { label: "📰 Club post", cls: "bg-ink-50 text-ink-600 ring-ink-200" },
  PHOTO_SET: { label: "📷 Photos", cls: "bg-hoop-50 text-hoop-700 ring-hoop-200" },
  VIDEO: { label: "🎥 Video", cls: "bg-hoop-50 text-hoop-700 ring-hoop-200" },
}

const AVATAR_BG = ["bg-play-600", "bg-court-600", "bg-hoop-600", "bg-gold-500", "bg-ink-700"]

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
export function FeedCard({ item, manageable = false }: { item: FeedItem; manageable?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState(item.body)
  const [captionDraft, setCaptionDraft] = useState(item.body)
  const [deleted, setDeleted] = useState(false)
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

  const saveCaption = async () => {
    setEditing(false)
    setCaption(captionDraft)
    await fetch(`/api/posts/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: captionDraft.trim() || " " }),
    })
  }
  const deletePost = async () => {
    if (!confirm("Delete this post? Likes, comments, and reposts go with it.")) return
    setDeleted(true)
    await fetch(`/api/posts/${item.id}`, { method: "DELETE" })
  }

  if (deleted) return null

  const authorLabel = item.authorName ?? "SportsHub One"
  const chip = item.isSystemFinal
    ? { label: "🏁 Final score", cls: "bg-court-50 text-court-700 ring-court-200" }
    : KIND_CHIP[item.kind]
  const avatarCls = AVATAR_BG[(authorLabel.charCodeAt(0) + authorLabel.length) % AVATAR_BG.length]

  return (
    <article className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {item.repostedBy && (
        <p className="text-ink-500 bg-ink-50/70 border-ink-100 flex items-center gap-1.5 border-b px-4 py-1.5 text-xs font-semibold">
          <Ic d={IC.repeat} className="h-3.5 w-3.5" /> {item.repostedBy} reposted
        </p>
      )}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
              item.authorName ? avatarCls : "bg-ink-950"
            )}
          >
            {item.authorName ? authorLabel.slice(0, 1) : "S"}
          </span>
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-[13px] font-semibold">{authorLabel}</p>
            <p className="text-ink-400 text-[11px] font-medium">
              {timeAgo(item.repostedAt ?? item.publishedAt)}
              {item.visibility === "FOLLOWERS" ? " · 🔒 Followers" : ""}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {chip && (
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset", chip.cls)}>
              {chip.label}
            </span>
          )}
          {manageable && (
            <span className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Manage post"
                className="text-ink-400 hover:bg-ink-50 hover:text-ink-800 rounded-full p-1.5"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {menuOpen && (
                <span className="border-ink-100 absolute right-0 top-8 z-20 flex w-40 flex-col overflow-hidden rounded-xl border bg-white shadow-lg">
                  <button
                    onClick={() => { setMenuOpen(false); setCaptionDraft(caption); setEditing(true) }}
                    className="text-ink-700 hover:bg-ink-50 px-3.5 py-2.5 text-left text-sm font-semibold"
                  >
                    Edit caption
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); void deletePost() }}
                    className="hover:bg-hoop-50 px-3.5 py-2.5 text-left text-sm font-semibold text-red-600"
                  >
                    Delete post
                  </button>
                </span>
              )}
            </span>
          )}
        </span>
      </div>

      <Link href={href} className="block px-4 pt-1.5">
        <h3 className="text-ink-950 text-[15px] font-bold leading-snug">{item.title}</h3>
        {caption.trim() && !editing && (
          <p className="text-ink-600 mt-1 line-clamp-3 text-sm">{caption}</p>
        )}
      </Link>
      {editing && (
        <div className="space-y-2 px-4 pt-2">
          <textarea
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Write a caption…"
            className="border-ink-200 w-full rounded-xl border px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-ink-500 hover:bg-ink-50 rounded-lg px-3 py-1.5 text-xs font-semibold">
              Cancel
            </button>
            <button onClick={saveCaption} className="bg-play-600 hover:bg-play-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white">
              Save
            </button>
          </div>
        </div>
      )}

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

      <div className="border-ink-50 text-ink-500 mt-2.5 flex items-center border-t px-2 py-1 text-xs font-semibold">
        <span className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className={cn(
              "hover:bg-hoop-50 hover:text-hoop-600 flex items-center gap-1.5 rounded-full px-3 py-2 transition",
              myEmojis.length > 0 && "text-hoop-600"
            )}
          >
            {myEmojis.length > 0 ? (
              <span className="text-sm leading-none">{myEmojis.join("")}</span>
            ) : (
              <Ic d={IC.heart} />
            )}
            {reactionCount > 0 ? reactionCount : "Like"}
          </button>
          {pickerOpen && (
            <span className="border-ink-100 absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-full border bg-white px-2 py-1.5 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => react(e)}
                  className={cn(
                    "rounded-full px-1 text-lg transition hover:scale-125",
                    myEmojis.includes(e) && "bg-play-50"
                  )}
                >
                  {e}
                </button>
              ))}
            </span>
          )}
        </span>
        <button
          onClick={openComments}
          className="hover:bg-play-50 hover:text-play-700 flex items-center gap-1.5 rounded-full px-3 py-2 transition"
        >
          <Ic d={IC.chat} />
          {commentCount > 0 ? commentCount : "Comment"}
        </button>
        {item.visibility === "PUBLIC" && (
          <button
            onClick={toggleRepost}
            className={cn(
              "hover:bg-court-50 hover:text-court-700 flex items-center gap-1.5 rounded-full px-3 py-2 transition",
              reposted && "text-court-700"
            )}
          >
            <Ic d={IC.repeat} filled={false} />
            {repostCount > 0 ? repostCount : "Repost"}
          </button>
        )}
        {item.visibility === "PUBLIC" && (
          <button
            onClick={openSend}
            className="hover:bg-ink-50 hover:text-ink-800 ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 transition"
          >
            <Ic d={IC.send} />
            Send
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
