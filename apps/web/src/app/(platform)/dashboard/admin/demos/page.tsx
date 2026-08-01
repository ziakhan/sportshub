import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { DEMO_SCENARIOS } from "../../../../../../../../scripts/demo-scenarios"
import { DemoLoader } from "./demo-loader"

export const dynamic = "force-dynamic"

/**
 * Admin › Demos (owner 2026-08-01): press a button, load a demo world.
 * Staged scenarios expose fast-forward buttons; loads replace the demo
 * world, fast-forwards only ADD (live demo actions survive).
 */
export default async function AdminDemosPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  const isAdmin = user.roles.some((r: any) => r.role === "PlatformAdmin")
  if (!isAdmin) redirect("/dashboard")

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-ink-900 text-2xl font-bold">Demo worlds</h1>
      <p className="text-ink-500 mt-1 max-w-2xl text-sm">
        Load a scenario before a pitch. Loading <strong>replaces</strong> the whole demo world
        (real users and clubs are never touched); fast-forwarding a staged scenario only adds —
        anything you demoed live stays.
      </p>
      <DemoLoader
        scenarios={DEMO_SCENARIOS.filter((s) => s.implemented).map((s) => ({
          key: s.key,
          title: s.title,
          description: s.description,
          estMinutes: s.estMinutes,
          stages: s.stages ?? null,
        }))}
      />
    </div>
  )
}
