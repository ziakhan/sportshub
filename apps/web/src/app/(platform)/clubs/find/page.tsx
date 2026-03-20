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
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

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
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to submit claim" })
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
      setTimeout(() => { window.location.href = "/dashboard" }, 2000)
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Verification failed" })
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Find Your Club</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search for your basketball club and claim ownership. If your club isn&apos;t listed,
            you can <Link href="/clubs/create" className="text-orange-600 hover:underline">create a new one</Link>.
          </p>
        </div>

        {message && (
          <div className={`mb-6 rounded-md p-4 text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
            message.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-orange-50 text-orange-700 border border-orange-200"
          }`}>
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
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading || query.length < 2}
            className="rounded-md bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "..." : "Search"}
          </button>
        </div>

        {/* Results */}
        {searched && clubs.length === 0 && !loading && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No clubs found</h3>
            <p className="text-gray-600 mb-4">
              We couldn&apos;t find a matching club. You can create a new one instead.
            </p>
            <Link
              href="/clubs/create"
              className="inline-block rounded-md bg-green-600 px-6 py-2 text-white font-semibold hover:bg-green-700"
            >
              Create New Club
            </Link>
          </div>
        )}

        {clubs.length > 0 && (
          <div className="space-y-3">
            {clubs.map((club) => (
              <div key={club.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{club.name}</h3>
                    <p className="text-sm text-gray-500">
                      {[club.city, club.state, club.country].filter(Boolean).join(", ")}
                    </p>
                    {club.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{club.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      {club.contactEmail && <span>Email: {club.contactEmail}</span>}
                      {club.phoneNumber && <span>Phone: {club.phoneNumber}</span>}
                      {club.website && (
                        <a href={club.website} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                          Website
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    {club.myClaimStatus === "APPROVED" ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Claimed by you
                      </span>
                    ) : club.myClaimStatus ? (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                        Claim {club.myClaimStatus.toLowerCase().replace("_", " ")}
                      </span>
                    ) : club.hasPendingClaim ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        Claim pending
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaim(club.id)}
                        disabled={claimingId === club.id}
                        className="rounded-md bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {claimingId === club.id ? "..." : "Claim This Club"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Verification code input */}
                {verifyingId === club.id && (
                  <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm text-orange-700 mb-3">
                      Enter the 6-digit verification code sent to the club&apos;s email:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-center text-lg font-mono tracking-widest shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleVerify(club.id)}
                        disabled={verifyCode.length !== 6}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
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
          <p className="text-sm text-gray-500 mb-2">Don&apos;t see your club?</p>
          <Link
            href="/clubs/create"
            className="inline-block rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Create a New Club
          </Link>
        </div>
      </div>
    </div>
  )
}
