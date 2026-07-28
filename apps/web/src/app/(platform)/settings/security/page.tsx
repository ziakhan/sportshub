"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button, Card, SmartBack } from "@/components/ui"

const labelClass = "block text-sm font-medium text-ink-800"
const inputClass =
  "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

async function patchSecurity(body: Record<string, string>) {
  const res = await fetch("/api/user/security", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.")
  return data
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
        {error}
      </div>
    )
  }
  if (success) {
    return (
      <div className="text-court-700 mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
        {success}
      </div>
    )
  }
  return null
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirm) {
      setError("New passwords do not match")
      return
    }

    setBusy(true)
    try {
      await patchSecurity({ action: "changePassword", currentPassword, newPassword })
      setSuccess("Password updated.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirm("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-ink-900 mb-1 text-lg font-semibold">Change password</h2>
      <p className="text-ink-500 mb-4 text-sm">
        Use at least 8 characters. You&apos;ll stay signed in on this device.
      </p>

      <Feedback error={error} success={success} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="pw-current" className={labelClass}>
            Current password
          </label>
          <input
            id="pw-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pw-new" className={labelClass}>
              New password
            </label>
            <input
              id="pw-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pw-confirm" className={labelClass}>
              Confirm new password
            </label>
            <input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
        </div>
        <Button type="submit" tone="play" disabled={busy}>
          {busy ? "Updating..." : "Update password"}
        </Button>
      </form>
    </Card>
  )
}

function ChangeEmailCard() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const data = await patchSecurity({ action: "changeEmail", currentPassword, newEmail })
      setSuccess(
        `Email updated to ${data.email}. Use your new email address the next time you sign in.`
      )
      setCurrentPassword("")
      setNewEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-ink-900 mb-1 text-lg font-semibold">Change email</h2>
      <p className="text-ink-500 mb-4 text-sm">
        Your email is how you sign in. After changing it, you&apos;ll need to sign in with the new
        address next time.
      </p>

      <Feedback error={error} success={success} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email-new" className={labelClass}>
            New email
          </label>
          <input
            id="email-new"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="email-password" className={labelClass}>
            Current password
          </label>
          <input
            id="email-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <Button type="submit" tone="play" disabled={busy}>
          {busy ? "Updating..." : "Update email"}
        </Button>
      </form>
    </Card>
  )
}

function DeleteAccountCard() {
  const [confirmText, setConfirmText] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = confirmText === "DELETE" && currentPassword.length > 0 && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirmText !== "DELETE") return
    setError(null)
    setBusy(true)
    try {
      await patchSecurity({ action: "deleteAccount", currentPassword })
      // Account is gone — end the session and land on the public homepage.
      await signOut({ callbackUrl: "/" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setBusy(false)
    }
  }

  return (
    <Card className="!border-red-200">
      <h2 className="mb-1 text-lg font-semibold text-red-700">Danger zone</h2>
      <p className="text-ink-500 mb-4 text-sm">
        Deleting your account signs you out everywhere and frees your email address. Your name
        stays visible in historical records like past rosters and box scores. This cannot be
        undone.
      </p>

      <Feedback error={error} success={null} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="delete-confirm" className={labelClass}>
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className={inputClass}
            placeholder="DELETE"
          />
        </div>
        <div>
          <label htmlFor="delete-password" className={labelClass}>
            Current password
          </label>
          <input
            id="delete-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <Button type="submit" tone="hoop" disabled={!canDelete}>
          {busy ? "Deleting..." : "Delete my account"}
        </Button>
      </form>
    </Card>
  )
}

export default function SecuritySettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6 md:p-8">
      <div>
        <SmartBack fallback="/settings/profile" fallbackLabel="Profile" className="-ml-1 mb-1" />
        <h1 className="text-ink-900 text-2xl font-semibold">Security &amp; sign-in</h1>
        <p className="text-ink-600 mt-1 text-sm">Manage how you sign in to your account.</p>
      </div>

      <ChangePasswordCard />
      <ChangeEmailCard />
      <DeleteAccountCard />
    </div>
  )
}
