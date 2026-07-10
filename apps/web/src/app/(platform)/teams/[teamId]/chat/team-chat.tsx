"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format, isSameDay, isToday, isYesterday } from "date-fns"
import type { ChatMembers } from "@/lib/teams/chat-access"
import { PollBubble, type ChatPollData } from "@/components/chat/poll-bubble"

interface ChatMessage {
  id: string
  body: string
  createdAt: string
  poll?: ChatPollData | null
  sender: { id: string; name: string; isStaff: boolean }
  pending?: boolean
}

interface PollUpdate {
  messageId: string
  poll: ChatPollData
}

const POLL_MS = 5000

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "EEEE, MMM d")
}

export function TeamChat({
  teamId,
  currentUserId,
  canModerate,
  members,
  archived = false,
}: {
  teamId: string
  currentUserId: string
  canModerate: boolean
  members: ChatMembers
  /** Archived teams keep the thread readable but nothing new can be posted. */
  archived?: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  // Quick poll composer (staff)
  const [showPollForm, setShowPollForm] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""])
  const [pollMulti, setPollMulti] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const memberCount = members.userIds.length

  const mergeNewer = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...current, ...fresh] : current
    })
  }, [])

  // Votes mutate existing poll messages — every fetch ships fresh counts
  const applyPollUpdates = useCallback((updates: PollUpdate[] | undefined) => {
    if (!updates || updates.length === 0) return
    const byMessage = new Map(updates.map((u) => [u.messageId, u.poll]))
    setMessages((current) =>
      current.map((m) => {
        const poll = byMessage.get(m.id)
        return poll ? { ...m, poll } : m
      })
    )
  }, [])

  const updatePoll = useCallback((poll: ChatPollData) => {
    setMessages((current) => current.map((m) => (m.poll?.id === poll.id ? { ...m, poll } : m)))
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/messages`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (cancelled) return
        setMessages(data.messages)
        setHasMore(data.hasMore)
        applyPollUpdates(data.pollUpdates)
      } catch {
        if (!cancelled) setError("Couldn't load the chat — refresh to try again.")
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [teamId, applyPollUpdates])

  // Poll for new messages
  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(async () => {
      const last = messages[messages.length - 1]
      const query = last ? `?after=${encodeURIComponent(last.createdAt)}` : ""
      try {
        const res = await fetch(`/api/teams/${teamId}/messages${query}`)
        if (!res.ok) return
        const data = await res.json()
        mergeNewer(data.messages)
        applyPollUpdates(data.pollUpdates)
      } catch {
        // transient network blip — next tick retries
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [teamId, loaded, messages, mergeNewer, applyPollUpdates])

  // Keep pinned to the bottom unless the reader scrolled up
  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function loadOlder() {
    const first = messages[0]
    if (!first) return
    const el = listRef.current
    const prevHeight = el?.scrollHeight ?? 0
    try {
      const res = await fetch(
        `/api/teams/${teamId}/messages?before=${encodeURIComponent(first.createdAt)}`
      )
      if (!res.ok) return
      const data = await res.json()
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id))
        return [...data.messages.filter((m: ChatMessage) => !known.has(m.id)), ...current]
      })
      setHasMore(data.hasMore)
      // hold the viewport position instead of jumping to the new top
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      })
    } catch {
      // leave hasMore as-is; the button stays for a retry
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    stickToBottom.current = true
    try {
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't send — try again.")
        return
      }
      setInput("")
      mergeNewer([data.message])
    } catch {
      setError("Couldn't send — check your connection.")
    } finally {
      setSending(false)
    }
  }

  async function sendPoll() {
    const question = pollQuestion.trim()
    const options = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (!question || options.length < 2 || sending) return
    setSending(true)
    setError(null)
    stickToBottom.current = true
    try {
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll: { question, options, allowMultiple: pollMulti } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't post the poll — try again.")
        return
      }
      setShowPollForm(false)
      setPollQuestion("")
      setPollOptions(["", ""])
      setPollMulti(false)
      mergeNewer([data.message])
    } catch {
      setError("Couldn't post the poll — check your connection.")
    } finally {
      setSending(false)
    }
  }

  async function deleteMessage(id: string) {
    const previous = messages
    setMessages((current) => current.filter((m) => m.id !== id))
    try {
      const res = await fetch(`/api/teams/${teamId}/messages/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
    } catch {
      setMessages(previous)
      setError("Couldn't remove the message — try again.")
    }
  }

  return (
    <div className="border-ink-100 shadow-soft flex min-h-0 flex-1 flex-col rounded-2xl border bg-white">
      {/* Members bar */}
      <div className="border-ink-100 border-b">
        <button
          onClick={() => setShowMembers((v) => !v)}
          className="text-ink-600 hover:bg-court-50 flex w-full items-center justify-between px-4 py-2 text-xs font-semibold"
        >
          <span>
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </span>
          <span className="text-ink-400">{showMembers ? "Hide ▴" : "Show ▾"}</span>
        </button>
        {showMembers && (
          <div className="bg-court-50/60 max-h-56 space-y-3 overflow-y-auto px-4 py-3">
            {members.staff.length > 0 && (
              <div>
                <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-wider">
                  Staff — chat admins
                </p>
                <div className="space-y-1">
                  {members.staff.map((s) => (
                    <div key={s.userId} className="flex items-center justify-between text-xs">
                      <span className="text-ink-900 font-medium">
                        {s.name}
                        {s.userId === currentUserId ? " (you)" : ""}
                      </span>
                      <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {members.families.length > 0 && (
              <div>
                <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-wider">
                  Families
                </p>
                <div className="space-y-1">
                  {members.families.map((f) => (
                    <div key={f.userId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-ink-900 truncate font-medium">
                        {f.name}
                        {f.userId === currentUserId ? " (you)" : ""}
                      </span>
                      <span className="text-ink-500 truncate">{f.playerNames.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto p-4">
        {!loaded ? (
          <p className="text-ink-400 py-10 text-center text-sm">Loading chat…</p>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-ink-600 font-medium">No messages yet</p>
            <p className="text-ink-400 mt-1 text-sm">
              Say hi — coaches and families of this team can read and post here.
            </p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="mb-3 text-center">
                <button
                  onClick={loadOlder}
                  className="text-play-600 bg-play-50 hover:bg-play-100 rounded-full px-3 py-1 text-xs font-semibold"
                >
                  Load earlier messages
                </button>
              </div>
            )}
            {messages.map((message, i) => {
              const created = new Date(message.createdAt)
              const prev = messages[i - 1]
              const showDay = !prev || !isSameDay(new Date(prev.createdAt), created)
              const mine = message.sender.id === currentUserId
              return (
                <div key={message.id}>
                  {showDay && (
                    <div className="my-3 text-center">
                      <span className="bg-court-50 text-ink-400 rounded-full px-3 py-0.5 text-[11px] font-medium">
                        {dayLabel(created)}
                      </span>
                    </div>
                  )}
                  <div className={`group mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                        message.poll
                          ? "border-ink-100 w-full border bg-white sm:w-[85%]"
                          : mine
                            ? "bg-play-600 text-white"
                            : "bg-court-50 text-ink-900"
                      }`}
                    >
                      {(!mine || message.poll) && (
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span className="text-ink-800 text-xs font-semibold">
                            {mine ? "You" : message.sender.name}
                          </span>
                          {message.sender.isStaff && (
                            <span className="bg-play-100 text-play-700 rounded-full px-1.5 py-px text-[10px] font-bold">
                              STAFF
                            </span>
                          )}
                        </div>
                      )}
                      {message.poll ? (
                        <PollBubble teamId={teamId} poll={message.poll} onUpdate={updatePoll} />
                      ) : (
                        <p className="whitespace-pre-line break-words text-sm">{message.body}</p>
                      )}
                      <div
                        className={`mt-0.5 flex items-center justify-end gap-2 text-[10px] ${
                          mine && !message.poll ? "text-play-100" : "text-ink-400"
                        }`}
                      >
                        {(mine || canModerate) && (
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="hidden font-semibold underline-offset-2 hover:underline group-hover:inline"
                            title={mine ? "Delete message" : "Remove message (staff)"}
                          >
                            {mine ? "Delete" : "Remove"}
                          </button>
                        )}
                        <span>{format(created, "h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mx-4 mb-2 rounded-xl border px-3 py-1.5 text-xs">
          {error}
        </div>
      )}

      {!archived && showPollForm && (
        <div className="border-ink-100 space-y-2 border-t p-3">
          <div className="flex items-center justify-between">
            <p className="text-ink-700 text-xs font-bold">📊 Quick poll</p>
            <label className="text-ink-500 flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={pollMulti}
                onChange={(e) => setPollMulti(e.target.checked)}
              />
              Multiple choices
            </label>
          </div>
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            maxLength={300}
            placeholder="Ask the team something…"
            className="border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
          />
          {pollOptions.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) =>
                  setPollOptions((cur) => cur.map((o, j) => (j === i ? e.target.value : o)))
                }
                maxLength={100}
                placeholder={`Option ${i + 1}`}
                className="border-ink-200 focus:border-play-500 min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((cur) => cur.filter((_, j) => j !== i))}
                  className="text-ink-400 shrink-0 text-lg leading-none hover:text-red-500"
                  aria-label="Remove option"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            {pollOptions.length < 6 ? (
              <button
                type="button"
                onClick={() => setPollOptions((cur) => [...cur, ""])}
                className="text-play-600 hover:text-play-700 text-xs font-semibold"
              >
                + Add option
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={sendPoll}
              disabled={
                sending ||
                !pollQuestion.trim() ||
                pollOptions.filter((o) => o.trim()).length < 2
              }
              className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {sending ? "Posting…" : "Post poll"}
            </button>
          </div>
        </div>
      )}

      {archived ? (
        <div className="border-ink-100 bg-ink-50 border-t px-4 py-3 text-center">
          <p className="text-ink-500 text-xs font-semibold">
            This team is archived — chat is read-only history.
          </p>
        </div>
      ) : (
      <form onSubmit={sendMessage} className="border-ink-100 flex gap-2 border-t p-3">
        <button
          type="button"
          onClick={() => setShowPollForm((v) => !v)}
          className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
            showPollForm
              ? "border-play-400 bg-play-50 text-play-700"
              : "border-ink-200 text-ink-500 hover:bg-ink-50"
          }`}
          title="Post a quick poll"
          aria-label="Post a quick poll"
        >
          📊
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Message the team…"
          className="border-ink-200 focus:border-play-500 min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-play-600 hover:bg-play-700 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
      )}
    </div>
  )
}
