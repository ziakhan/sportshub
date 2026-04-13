import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { CreateClubForm } from "./create-club-form"

export default async function CreateClubPage() {
  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-ink-900 text-3xl font-semibold">Create Your Club</h1>
          <p className="text-ink-700 mt-2">
            Set up your youth basketball club and start managing teams, tryouts, and more.
          </p>
        </div>

        <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
          <CreateClubForm />
        </div>

        <div className="border-play-200 bg-play-50 mt-8 rounded-2xl border p-6">
          <h3 className="text-play-900 mb-2 font-semibold">What&apos;s included:</h3>
          <ul className="text-play-800 space-y-2 text-sm">
            <li>✓ Create and manage unlimited teams</li>
            <li>✓ Host tryouts and collect registrations</li>
            <li>✓ Accept payments with Stripe Connect</li>
            <li>✓ Join leagues and schedule games</li>
            <li>✓ Track player stats and standings</li>
            <li>✓ Your own subdomain ({"{slug}"}.youthbasketballhub.com)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
