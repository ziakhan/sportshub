import { redirect } from "next/navigation"
import Link from "next/link"
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
          <h1 className="text-3xl font-bold text-gray-900">Create Your Club</h1>
          <p className="mt-2 text-gray-600">
            Set up your youth basketball club and start managing teams, tryouts, and more.
          </p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-lg">
          <CreateClubForm />
        </div>

        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-2 font-semibold text-blue-900">What&apos;s included:</h3>
          <ul className="space-y-2 text-sm text-blue-800">
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
