"use client"

import { useState } from "react"
import { SignaturePad } from "@/components/scoring/signature-pad"

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
        <p className="text-4xl">✅</p>
        <h2 className="mt-3 text-lg font-bold text-gray-900">
          {done.alreadySigned ? "Already signed" : "Signed and recorded"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
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
          <label htmlFor="signer-name" className="block text-sm font-semibold text-gray-700">
            Your full name
          </label>
          <input
            id="signer-name"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="First and last name"
            className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label htmlFor="relationship" className="block text-sm font-semibold text-gray-700">
            Relationship to player
          </label>
          <select
            id="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="Parent/Guardian">Parent or guardian</option>
            <option value="Player (18+)">Player (18 or older)</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="block text-sm font-semibold text-gray-700">Signature</span>
          <span className="text-xs text-gray-400">Draw with your finger or mouse</span>
        </div>
        <div className="mt-1.5 overflow-hidden rounded-xl border border-gray-300">
          <SignaturePad onChange={setSignature} height={150} />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          I have read and understood this document, and I confirm that I am authorized to
          sign it for {playerName}.
        </span>
      </label>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Recording signature..." : "Sign and submit"}
      </button>

      <p className="text-center text-xs leading-relaxed text-gray-400">
        Your signature, name, the exact document text, and the date and time are stored
        securely as your signed record.
      </p>
    </div>
  )
}
