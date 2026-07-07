"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"

/**
 * Floating team-chat dock (public pages, signed-in members only).
 * Desktop: bottom-right bubble → 360×480 popup with a chat list + inline
 * conversation, so families chat while browsing scores. Phones: the same
 * panel goes full-screen. Messages ride the same REST + 5s polling as the
 * full chat page.
 */

interface DockTeam {
  teamId: string
  teamName: string
  clubName: string
  unread: number
}

interface DockMessage {
  id: string
  body: string
  createdAt: string
  sender: { id: string; name: string; isStaff: boolean }
}

const POLL_MS = 5000
const SUMMARY_POLL_MS = 30_000

export function ChatDock({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<DockTeam[] | null>(null)
  const [open, setOpen] = useState(false)
  const [activeTeam, setActiveTeam] = useState<DockTeam | null>(null)

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/summary")
      if (!res.ok) return
      const data = await res.json()
      setTeams(data.teams)
    } catch {
      // dock is best-effort chrome — stay quiet on network blips
    }
  }, [])

  useEffect(() => {
    loadSummary()
    const timer = setInterval(loadSummary, SUMMARY_POLL_MS)
    return () => clearInterval(timer)
  }, [loadSummary])

  if (!teams || teams.length === 0) return null
  const totalUnread = teams.reduce((sum, t) => sum + t.unread, 0)

  return (
    <>
      {/* Collapsed bubble */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true)
            if (teams.length === 1) setActiveTeam(teams[0])
          }}
          className="bg-play-600 hover:bg-play-700 fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition"
          aria-label={`Team chat${totalUnread > 0 ? ` — ${totalUnread} unread` : ""}`}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
          </svg>
          {totalUnread > 0 && (
            <span className="bg-hoop-500 absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Panel: popup on desktop, full-screen sheet on phones */}
      {open && (
        <div className="border-ink-200 fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl max-sm:inset-0 sm:bottom-5 sm:right-5 sm:h-[520px] sm:w-[370px] sm:rounded-3xl sm:border">
          <div className="bg-ink-950 flex items-center gap-2 px-4 py-3 text-white">
            {activeTeam ? (
              <>
                <button
                  onClick={() => {
                    setActiveTeam(null)
                    loadSummary()
                  }}
                  className="hover:bg-ink-800 -ml-1 rounded-lg p-1"
                  aria-label="Back to chat list"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{activeTeam.teamName}</p>
                  <p className="text-ink-300 truncate text-[11px]">{activeTeam.clubName}</p>
                </div>
                <Link
                  href={`/teams/${activeTeam.teamId}/chat`}
                  className="text-ink-300 text-[11px] font-semibold hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  Full view ↗
                </Link>
              </>
            ) : (
              <p className="flex-1 text-sm font-bold">Team chats</p>
            )}
            <button
              onClick={() => setOpen(false)}
              className="hover:bg-ink-800 rounded-lg p-1"
              aria-label="Close chat"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {activeTeam ? (
            <DockConversation teamId={activeTeam.teamId} userId={userId} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {teams.map((team) => (
                <button
                  key={team.teamId}
                  onClick={() => setActiveTeam(team)}
                  className="border-ink-50 hover:bg-court-50 flex w-full items-center gap-3 border-b px-4 py-3 text-left"
                >
                  <span className="bg-play-100 text-play-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                    {team.teamName.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-900 block truncate text-sm font-semibold">
                      {team.teamName}
                    </span>
                    <span className="text-ink-400 block truncate text-xs">{team.clubName}</span>
                  </span>
                  {team.unread > 0 && (
                    <span className="bg-hoop-500 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                      {team.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function DockConversation({ teamId, userId }: { teamId: string; userId: string }) {
  const [messages, setMessages] = useState<DockMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const mergeNewer = useCallback((incoming: DockMessage[]) => {
    if (incoming.length === 0) return
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...current, ...fresh] : current
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setMessages([])
    setLoaded(false)
    ;(async () => {
      const res = await fetch(`/api/teams/${teamId}/messages`).catch(() => null)
      if (cancelled || !res?.ok) return
      const data = await res.json()
      setMessages(data.messages)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [teamId])

  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(async () => {
      const last = messages[messages.length - 1]
      const query = last ? `?after=${encodeURIComponent(last.createdAt)}` : ""
      const res = await fetch(`/api/teams/${teamId}/messages${query}`).catch(() => null)
      if (!res?.ok) return
      const data = await res.json()
      mergeNewer(data.messages)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [teamId, loaded, messages, mergeNewer])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        const data = await res.json()
        setInput("")
        mergeNewer([data.message])
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!loaded ? (
          <p className="text-ink-400 py-8 text-center text-sm">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-ink-400 py-8 text-center text-sm">No messages yet — say hi!</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender.id === userId
            return (
              <div key={message.id} className={`mb-1.5 flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${
                    mine ? "bg-play-600 text-white" : "bg-court-50 text-ink-900"
                  }`}
                >
                  {!mine && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold">
                      {message.sender.name}
                      {message.sender.isStaff && (
                        <span className="bg-play-100 text-play-700 rounded-full px-1 py-px text-[9px] font-bold">
                          STAFF
                        </span>
                      )}
                    </span>
                  )}
                  <p className="whitespace-pre-line break-words text-[13px]">{message.body}</p>
                  <p className={`text-right text-[9px] ${mine ? "text-play-100" : "text-ink-400"}`}>
                    {format(new Date(message.createdAt), "h:mm a")}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={send} className="border-ink-100 flex gap-2 border-t p-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Message the team…"
          className="border-ink-200 focus:border-play-500 min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-play-600 hover:bg-play-700 shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </>
  )
}
