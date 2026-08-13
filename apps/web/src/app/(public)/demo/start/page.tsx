import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isDemoModeEnabled } from "@/lib/demo/demo-mode"
import { PUBLIC_PERSONAS } from "@/lib/demo/persona-session"
import { DemoStartClient } from "./start-client"

export const dynamic = "force-dynamic"

/**
 * Landing that finishes demo entry after signup/sign-in
 * (?persona=parent|player|coach|club|league). Signed in → auto-enter;
 * signed out → hand off to sign-up and come back here.
 */
export default async function DemoStartPage({
  searchParams,
}: {
  searchParams: { persona?: string }
}) {
  if (!(await isDemoModeEnabled())) redirect("/")
  const session = await getServerSession(authOptions).catch(() => null)
  // All five public personas (owner ruling 2026-08-13) — this list had been
  // left at parent/coach/club, so a visitor who picked Player or League
  // signed up and landed silently in the PARENT world.
  const persona = (PUBLIC_PERSONAS as readonly string[]).includes(searchParams.persona ?? "")
    ? (searchParams.persona as string)
    : "parent"
  return <DemoStartClient persona={persona} signedIn={!!session?.user} />
}
