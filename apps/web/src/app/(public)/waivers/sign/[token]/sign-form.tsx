"use client"

import { useState } from "react"
import { SignaturePad } from "@/components/scoring/signature-pad"
import { ChipGroup } from "@/components/ui"

/** Same two values the API has always stored; only the paint changed. */
const RELATIONSHIPS = [
  { value: "Parent/Guardian", label: "Parent or guardian" },
  { value: "Player (18+)", label: "Player (18 or older)" },
]

export function SignForm({
  token,
  playerName,
  orgName,
}: {
  token: string
  playerName: string
  orgName: string
}) {
  const [signerName, setSignerName] = useState("")
  const [relationship, setRelationship] = useState("Parent/Guardian")
  const [signature, setSignature] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | { alreadySigned?: boolean }>(null)

  const canSubmit = agreed && signerName.trim().length >= 2 && !!signature && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/waivers/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          signerName: signerName.trim(),
          relationship,
          signatureData: signature,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }
      setDone({ alreadySigned: data.alreadySigned })
    } catch {
      setError("Something went wrong. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="p-6 text-center sm:p-8">
        <div className="bg-court-50 text-court-600 mx-auto grid h-14 w-14 place-items-center rounded-2xl">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-ink-950 mt-3 text-lg font-bold">
          {done.alreadySigned ? "Already signed" : "Signed and recorded"}
        </h2>
        <p className="text-ink-600 mt-2 text-sm leading-relaxed">
          {done.alreadySigned
            ? `Someone in your family already signed this for ${playerName}. Nothing more is needed.`
            : `Thank you. ${orgName} now has your signed copy on file for ${playerName}. You can close this page.`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="signer-name" className="text-ink-700 block text-sm font-semibold">
            Your full name
          </label>
          <input
            id="signer-name"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="First and last name"
            className="border-ink-200 focus:border-play-500 focus:ring-play-200 mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
          />
        </div>
        <div>
          <span className="text-ink-700 block text-sm font-semibold">
            Relationship to player
          </span>
          <ChipGroup
            ariaLabel="Relationship to player"
            className="mt-1.5"
            value={relationship}
            onChange={setRelationship}
            options={RELATIONSHIPS}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-ink-700 block text-sm font-semibold">Signature</span>
          <span className="text-ink-400 text-xs">Draw with your finger or mouse</span>
        </div>
        <div className="border-ink-200 mt-1.5 overflow-hidden rounded-xl border">
          <SignaturePad onChange={setSignature} height={150} />
        </div>
      </div>

      <label className="text-ink-700 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="border-ink-300 text-play-600 focus:ring-play-500 mt-0.5 h-4 w-4 rounded"
        />
        <span>
          I have read and understood this document, and I confirm that I am authorized to
          sign it for {playerName}.
        </span>
      </label>

      {error ? (
        <p className="bg-hoop-50 text-hoop-700 rounded-xl px-4 py-3 text-sm">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-6 py-3.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Recording signature..." : "Sign and submit"}
      </button>

      <p className="text-ink-400 text-center text-xs leading-relaxed">
        Your signature, name, the exact document text, and the date and time are stored
        securely as your signed record.
      </p>
    </div>
  )
}
