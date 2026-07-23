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
      className={className ?? "h-6 w-6"}
    >
      <path d={d} />
    </svg>
  )
}
const IC = {
  heart: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  chat: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  repeat: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
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
  const [dragY, setDragY] = useState(0)
  const dragStart = { y: 0 }

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

  const shareOutside = async () => {
    const url = `${window.location.origin}${href}`
    try {
      if (item.cardImage) {
        const res = await fetch(item.cardImage)
        const blob = await res.blob()
        const file = new File([blob], "sportshub-card.png", { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: item.title })
          return
        }
      }
      if (navigator.share) {
        await navigator.share({ title: item.title, url })
        return
      }
    } catch {
      /* cancelled or unsupported — fall through */
    }
    window.open(item.cardImage ?? url, "_blank")
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

      <div className="text-ink-800 mt-1 flex items-center gap-1 px-2.5 py-1 text-[13px] font-semibold">
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
            {reactionCount > 0 ? reactionCount : ""}
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
          {commentCount > 0 ? commentCount : ""}
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
            {repostCount > 0 ? repostCount : ""}
          </button>
        )}
        {item.visibility === "PUBLIC" && (
          <button
            onClick={openSend}
            className="hover:bg-ink-50 hover:text-ink-800 ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 transition"
          >
            <Ic d={IC.send} />
          </button>
        )}
      </div>

      {sendOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end overscroll-contain bg-black/50" onClick={() => setSendOpen(false)}>
        <div
          className="rounded-t-3xl bg-white p-4 pb-6 transition-transform"
          style={{ transform: `translateY(${dragY}px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Swipe-to-close lives ONLY on the grab handle (owner: strip
              scrolls were closing the sheet) — explicit downward pull here */}
          <div
            className="-mx-4 -mt-4 touch-none px-4 pb-2 pt-3"
            onTouchStart={(e) => { dragStart.y = e.touches[0].clientY }}
            onTouchMove={(e) => { const d = e.touches[0].clientY - dragStart.y; if (d > 0) setDragY(d) }}
            onTouchEnd={() => { if (dragY > 70) { setSendOpen(false) } setDragY(0) }}
          >
            <div className="bg-ink-300 mx-auto h-1.5 w-12 rounded-full" />
          </div>
          <p className="text-ink-900 mb-2 text-sm font-bold">Send in SportsHub</p>
          {sent ? (
            <p className="text-court-700 text-xs font-semibold">Sent to the team chat.</p>
          ) : teams === null ? (
            <p className="text-ink-500 text-xs">Loading your chats…</p>
          ) : teams.length === 0 ? (
            <p className="text-ink-500 text-xs">No team chats yet.</p>
          ) : (
            <div className="no-scrollbar flex gap-3 overflow-x-auto py-1">
              {teams.map((t, i) => (
                <button key={t.id} onClick={() => sendToTeam(t.id)} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                  <span className={cn("flex h-14 w-14 items-center justify-center rounded-full text-base font-extrabold text-white", AVATAR_BG[i % AVATAR_BG.length])}>
                    {t.name.slice(0, 1)}
                  </span>
                  <span className="text-ink-600 w-full truncate text-center text-[11px] font-medium">{t.name}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-ink-900 border-ink-100 mb-2 mt-3 border-t pt-3 text-sm font-bold">Share to</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto py-1">
            {([
              ["copy", "Copy link", "#3f3f46", () => { void navigator.clipboard.writeText(window.location.origin + href) }],
              ["instagram", "Instagram", "#E1306C", () => void shareOutside()],
              ["whatsapp", "WhatsApp", "#25D366", () => window.open(`https://wa.me/?text=${encodeURIComponent(item.title + " " + window.location.origin + href)}`, "_blank")],
              ["messages", "Messages", "#34C759", () => { window.location.href = `sms:?&body=${encodeURIComponent(item.title + " " + window.location.origin + href)}` }],
              ["facebook", "Facebook", "#1877F2", () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin + href)}`, "_blank")],
              ["email", "Email", "#6366f1", () => { window.location.href = `mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(window.location.origin + href)}` }],
              ["more", "More…", "#0f172a", () => void shareOutside()],
            ] as Array<[string, string, string, () => void]>).map(([kind, label, color, fn]) => (
              <button key={label} onClick={fn} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
                  {kind === "instagram" ? (
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="#fff" stroke="none"/></svg>
                  ) : kind === "whatsapp" ? (
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.4 0 .1 0 .7-.2 1.3z"/></svg>
                  ) : kind === "facebook" ? (
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#fff"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7h2.5z"/></svg>
                  ) : kind === "messages" ? (
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#fff"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 2.9 5.6-.2 1-.7 2.1-1.6 3 1.8-.2 3.3-.8 4.4-1.5 1.3.5 2.8.8 4.3.8 5.5 0 10-3.6 10-7.9S17.5 3 12 3z"/></svg>
                  ) : kind === "copy" ? (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
                  ) : kind === "email" ? (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.6" fill="#fff"/><circle cx="12" cy="12" r="1.6" fill="#fff"/><circle cx="19" cy="12" r="1.6" fill="#fff"/></svg>
                  )}
                </span>
                <span className="text-ink-600 w-full truncate text-center text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
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
