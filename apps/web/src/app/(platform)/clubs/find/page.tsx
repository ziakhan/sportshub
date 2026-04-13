"use client"

import { useState } from "react"
import Link from "next/link"

interface Club {
  id: string
  name: string
  city: string | null
  state: string | null
  country: string
  contactEmail: string | null
  phoneNumber: string | null
  website: string | null
  description: string | null
  hasPendingClaim: boolean
  myClaimStatus: string | null
}

export default function FindClubPage() {
  const [query, setQuery] = useState("")
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState("")
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)

  const handleSearch = async () => {
    if (query.length < 2) return
    setLoading(true)
    setSearched(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/clubs/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setClubs(data.clubs || [])
    } catch {
      setMessage({ type: "error", text: "Search failed" })
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (clubId: string) => {
    setClaimingId(clubId)
    setMessage(null)
    try {
      const res = await fetch(`/api/clubs/claim/${clubId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.hasEmail) {
        setVerifyingId(clubId)
        setMessage({ type: "info", text: data.message })
      } else {
        setMessage({ type: "success", text: data.message })
      }
      // Refresh search to update claim status
      handleSearch()
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to submit claim",
      })
    } finally {
      setClaimingId(null)
    }
  }

  const handleVerify = async (clubId: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/clubs/claim/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({ type: "success", text: data.message })
      setVerifyingId(null)
      setVerifyCode("")
      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 2000)
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Verification failed",
      })
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-ink-900 text-2xl font-semibold">Find Your Club</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Search for your basketball club and claim ownership. If your club isn&apos;t listed, you
            can{" "}
            <Link href="/clubs/create" className="text-play-700 hover:underline">
              create a new one
            </Link>
            .
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-xl p-4 text-sm ${
              message.type === "success"
                ? "bg-court-50 text-court-700 border-court-200 border"
                : message.type === "error"
                  ? "bg-hoop-50 text-hoop-700 border-hoop-200 border"
                  : "border-play-200 bg-play-50 text-play-700 border"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Search */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by club name or city..."
            className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 flex-1 rounded-xl border px-4 py-2 shadow-sm focus:outline-none focus:ring-2"
          />
          <button
            onClick={handleSearch}
            disabled={loading || query.length < 2}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {loading ? "..." : "Search"}
          </button>
        </div>

        {/* Results */}
        {searched && clubs.length === 0 && !loading && (
          <div className="border-ink-300 rounded-3xl border-2 border-dashed bg-white p-8 text-center">
            <h3 className="text-ink-900 mb-2 text-lg font-semibold">No clubs found</h3>
            <p className="text-ink-600 mb-4">
              We couldn&apos;t find a matching club. You can create a new one instead.
            </p>
            <Link
              href="/clubs/create"
              className="bg-hoop-600 hover:bg-hoop-700 inline-block rounded-xl px-6 py-2 font-semibold text-white transition"
            >
              Create New Club
            </Link>
          </div>
        )}

        {clubs.length > 0 && (
          <div className="space-y-3">
            {clubs.map((club) => (
              <div
                key={club.id}
                className="border-ink-100 rounded-3xl border bg-white p-5 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-ink-900 font-semibold">{club.name}</h3>
                    <p className="text-ink-500 text-sm">
                      {[club.city, club.state, club.country].filter(Boolean).join(", ")}
                    </p>
                    {club.description && (
                      <p className="text-ink-400 mt-1 line-clamp-2 text-xs">{club.description}</p>
                    )}
                    <div className="text-ink-500 mt-2 flex flex-wrap gap-2 text-xs">
                      {club.contactEmail && <span>Email: {club.contactEmail}</span>}
                      {club.phoneNumber && <span>Phone: {club.phoneNumber}</span>}
                      {club.website && (
                        <a
                          href={club.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-play-700 hover:underline"
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    {club.myClaimStatus === "APPROVED" ? (
                      <span className="text-court-700 rounded-full bg-green-100 px-3 py-1 text-xs font-medium">
                        Claimed by you
                      </span>
                    ) : club.myClaimStatus ? (
                      <span className="text-hoop-700 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium">
                        Claim {club.myClaimStatus.toLowerCase().replace("_", " ")}
                      </span>
                    ) : club.hasPendingClaim ? (
                      <span className="bg-court-100 text-ink-600 rounded-full px-3 py-1 text-xs font-medium">
                        Claim pending
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaim(club.id)}
                        disabled={claimingId === club.id}
                        className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
                      >
                        {claimingId === club.id ? "..." : "Claim This Club"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Verification code input */}
                {verifyingId === club.id && (
                  <div className="border-play-200 bg-play-50 mt-4 rounded-xl border p-4">
                    <p className="text-play-700 mb-3 text-sm">
                      Enter the 6-digit verification code sent to the club&apos;s email:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={verifyCode}
                        onChange={(e) =>
                          setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="000000"
                        maxLength={6}
                        className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-32 rounded-xl border px-3 py-2 text-center font-mono text-lg tracking-widest shadow-sm focus:outline-none focus:ring-2"
                      />
                      <button
                        onClick={() => handleVerify(club.id)}
                        disabled={verifyCode.length !== 6}
                        className="bg-hoop-600 hover:bg-hoop-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-ink-500 mb-2 text-sm">Don&apos;t see your club?</p>
          <Link
            href="/clubs/create"
            className="border-ink-200 text-ink-700 hover:bg-court-50 inline-block rounded-xl border px-6 py-2 text-sm font-medium transition"
          >
            Create a New Club
          </Link>
        </div>
      </div>
    </div>
  )
}
