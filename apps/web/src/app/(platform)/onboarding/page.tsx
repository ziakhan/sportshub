import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getCurrentUser } from "@/lib/auth-helpers"
import { OnboardingFlow } from "./onboarding-flow"

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/sign-in")
  }

  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  // If already onboarded, go to dashboard
  if (dbUser.onboardedAt) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <OnboardingFlow userName={dbUser.firstName || "there"} />
      </div>
    </div>
  )
}
