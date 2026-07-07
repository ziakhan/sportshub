"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Candidate {
  id: string
  name: string
  position: string | null
  birthYear: number | null
  currentTeams: string[]
}

interface PendingInvitation {
  id: string
  email: string
  playerName: string | null
}

/**
 * Manual roster controls (coaches + managers): add a player the club
 * already knows, or invite a brand-new family by email. The slow path
 * (tryout → offer → accept) stays the happy path — this is the escape hatch.
 */
export function RosterManager({
  teamId,
  templates,
  pendingInvitations,
}: {
  teamId: string
  templates: { id: string; name: string }[]
  pendingInvitations: PendingInvitation[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"add" | "invite">("add")
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [playerId, setPlayerId] = useState("")
  const [jersey, setJersey] = useState("")
  const [email, setEmail] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [inviteMessage, setInviteMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (!open || candidates !== null) return
    fetch(`/api/teams/${teamId}/players`)
      .then((r) => (r.ok ? r.json() : { candidates: [] }))
      .then((d) => setCandidates(d.candidates ?? []))
      .catch(() => setCandidates([]))
  }, [open, candidates, teamId])

  const addPlayer = async () => {
    if (!playerId) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          jerseyNumber: jersey === "" ? null : Number(jersey),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't add the player")
      setMessage({ type: "success", text: "Player added to the roster." })
      setPlayerId("")
      setJersey("")
      setCandidates(null)
      router.refresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Couldn't add" })
    } finally {
      setBusy(false)
    }
  }

  const invite = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/player-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          email: email.trim(),
          playerName: playerName.trim() || undefined,
          templateId: templateId || undefined,
          message: inviteMessage.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send the invitation")
      setMessage({ type: "success", text: `Invitation sent to ${email.trim()}.` })
      setEmail("")
      setPlayerName("")
      setInviteMessage("")
      router.refresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Couldn't invite" })
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (invitationId: string) => {
    if (!window.confirm("Revoke this invitation?")) return
    await fetch(`/api/player-invitations/${invitationId}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <div className="border-ink-100 shadow-soft mb-6 rounded-2xl border bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-ink-900 flex w-full items-center justify-between px-6 py-4 font-semibold"
      >
        <span>
          Add players manually
          {pendingInvitations.length > 0 && (
            <span className="bg-hoop-100 text-hoop-700 ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
              {pendingInvitations.length} invite{pendingInvitations.length !== 1 ? "s" : ""} pending
            </span>
          )}
        </span>
        <span className="text-ink-400 text-sm">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="border-ink-100 border-t px-6 py-4">
          {message && (
            <div
              className={`mb-3 rounded-xl border px-3 py-2 text-sm ${
                message.type === "success"
                  ? "border-court-200 bg-court-50 text-court-700"
                  : "border-hoop-200 bg-hoop-50 text-hoop-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-4 flex gap-1.5">
            {(
              [
                ["add", "Existing club player"],
                ["invite", "Invite by email"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  tab === key ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "add" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="text-ink-600 mb-1 block text-xs font-medium">
                  Player (anyone already connected to your club)
                </label>
                <select
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  className="border-ink-200 text-ink-900 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">
                    {candidates === null ? "Loading…" : "Choose player…"}
                  </option>
                  {(candidates ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.birthYear ? ` (${c.birthYear})` : ""}
                      {c.currentTeams.length ? ` — on ${c.currentTeams.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-ink-600 mb-1 block text-xs font-medium">Jersey #</label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value)}
                  placeholder="—"
                  className="border-ink-200 text-ink-900 w-20 rounded-xl border px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={addPlayer}
                disabled={busy || !playerId}
                className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add to roster"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-ink-600 mb-1 block text-xs font-medium">Parent email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parent@example.com"
                    className="border-ink-200 text-ink-900 w-full rounded-xl border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-ink-600 mb-1 block text-xs font-medium">
                    Player name (optional)
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. Marcus Chen"
                    className="border-ink-200 text-ink-900 w-full rounded-xl border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {templates.length > 0 && (
                <div>
                  <label className="text-ink-600 mb-1 block text-xs font-medium">
                    Offer package on acceptance (optional)
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="border-ink-200 text-ink-900 w-full rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="">No package — roster spot only</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={2}
                placeholder="Message to the family (optional)"
                className="border-ink-200 text-ink-900 w-full rounded-xl border px-3 py-2 text-sm"
              />
              <button
                onClick={invite}
                disabled={busy || !email.includes("@")}
                className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </div>
          )}

          {pendingInvitations.length > 0 && (
            <div className="border-ink-100 mt-4 border-t pt-3">
              <p className="text-ink-500 mb-2 text-xs font-medium uppercase tracking-wide">
                Pending invitations
              </p>
              <div className="space-y-1">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700 min-w-0 truncate">
                      {inv.playerName ? `${inv.playerName} — ` : ""}
                      {inv.email}
                    </span>
                    <button
                      onClick={() => revoke(inv.id)}
                      className="text-hoop-600 shrink-0 text-xs font-semibold hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
