"use client"

import { useRouter } from "next/navigation"

interface ImpersonationBannerProps {
  userName: string
}

export function ImpersonationBanner({ userName }: ImpersonationBannerProps) {
  const router = useRouter()

  async function stopImpersonating() {
    await fetch("/api/admin/impersonate", { method: "DELETE" })
    router.push("/dashboard/admin/users")
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between bg-yellow-400 px-4 py-2 text-sm font-medium text-yellow-900">
      <span>Viewing as: {userName}</span>
      <button
        onClick={stopImpersonating}
        className="rounded bg-yellow-600 px-3 py-1 text-xs font-bold text-white hover:bg-yellow-700"
      >
        Stop Impersonating
      </button>
    </div>
  )
}
