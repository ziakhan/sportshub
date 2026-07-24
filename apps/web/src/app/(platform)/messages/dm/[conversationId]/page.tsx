"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useRealtime } from "@/lib/realtime/use-realtime"
import { SmartBack } from "@/components/ui"

/**
 * Direct-message thread (owner 2026-07-15) — 1:1 inside a team context.
 * Same delta-poll + socket-ping protocol as team chat.
 */

interface DmMessage {
  id: string
  body: string
  createdAt: string
  editedAt: string | null
  sender: { id: string; name: string }
}

interface ConversationInfo {
  id: string
  teamId: string | null
  teamName: string | null
  otherName: string
  otherUserId: string | null
}

export default function DmThreadPage() {
  const params = useParams()
  const conversationId = params?.conversationId as string
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [convo, setConvo] = useState<ConversationInfo | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setMeId(d?.user?.id ?? null))
      .catch(() => {})
  }, [])

  const mergeNewer = useCallback((incoming: DmMessage[]) => {
    if (!incoming?.length) return
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...current, ...fresh] : current
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setMessages(data.messages ?? [])
        setConvo(data.conversation ?? null)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [conversationId])

  const fetchNewer = useCallback(async () => {
    const last = messages[messages.length - 1]
    const query = last ? `?after=${encodeURIComponent(last.createdAt)}` : ""
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages${query}`)
      if (!res.ok) return
      const data = await res.json()
      mergeNewer(data.messages ?? [])
    } catch {
      // next tick retries
    }
  }, [conversationId, messages, mergeNewer])

  const { connected } = useRealtime({
    rooms: [],
    events: { "dm.message": () => void fetchNewer() },
  })

  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(fetchNewer, connected ? 60_000 : 5000)
    return () => clearInterval(timer)
  }, [loaded, connected, fetchNewer])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  async function send() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        const data = await res.json()
        mergeNewer([data.message])
        setInput("")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-ink-950 truncate text-lg font-bold">
            {convo?.otherName ?? "Conversation"}
          </h1>
          {convo?.teamName && <p className="text-ink-500 truncate text-xs">{convo.teamName}</p>}
        </div>
        <SmartBack fallback="/messages" fallbackLabel="Messages" className="shrink-0" />
      </div>

      <div className="border-ink-100 flex-1 space-y-2 overflow-y-auto rounded-2xl border bg-white p-4">
        {loaded && messages.length === 0 && (
          <p className="text-ink-400 py-10 text-center text-sm">
            No messages yet — say hi to {convo?.otherName ?? "them"}.
          </p>
        )}
        {messages.map((m) => {
          const mine = meId !== null && m.sender.id === meId
          return (
            <div
              key={m.id}
              className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                mine ? "bg-play-600 ml-auto text-white" : "bg-ink-50 text-ink-900"
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
              <p className={`mt-0.5 text-[10px] ${mine ? "text-play-200" : "text-ink-400"}`}>
                {new Date(m.createdAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {m.editedAt ? " · edited" : ""}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          rows={1}
          placeholder={`Message ${convo?.otherName ?? ""}`}
          className="border-ink-200 focus:border-play-400 max-h-32 min-h-[42px] flex-1 resize-y rounded-xl border px-3 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={() => void send()}
          disabled={sending || !input.trim()}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
