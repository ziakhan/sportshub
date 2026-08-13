import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isDemoModeEnabled } from "@/lib/demo/demo-mode"
import { DemoStartClient } from "./start-client"

export const dynamic = "force-dynamic"

/**
 * Landing that finishes demo entry after signup/sign-in
 * (?persona=parent|coach|club). Signed in → auto-enter; signed out →
 * hand off to sign-up and come back here.
 */
export default async function DemoStartPage({
  searchParams,
}: {
  searchParams: { persona?: string }
}) {
  if (!(await isDemoModeEnabled())) redirect("/")
  const session = await getServerSession(authOptions).catch(() => null)
  const persona = ["parent", "coach", "club"].includes(searchParams.persona ?? "")
    ? (searchParams.persona as string)
    : "parent"
  return <DemoStartClient persona={persona} signedIn={!!session?.user} />
}
