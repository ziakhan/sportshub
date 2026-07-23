import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { CreateTrainerForm } from "./create-trainer-form"
import { SmartBack } from "@/components/ui"

export default async function CreateTrainerPage() {
  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <SmartBack fallback="/dashboard" fallbackLabel="Dashboard" className="-ml-1 mb-2" />
        <div className="mb-8">
          <h1 className="text-ink-900 text-3xl font-semibold">Set Up Your Training Business</h1>
          <p className="text-ink-700 mt-2">
            Your public page, programs, and bookings all hang off this profile.
          </p>
        </div>

        <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
          <CreateTrainerForm
            defaultName={
              [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || ""
            }
            defaultEmail={dbUser.email}
          />
        </div>

        <div className="border-play-200 bg-play-50 mt-8 rounded-2xl border p-6">
          <h3 className="text-play-900 mb-2 font-semibold">What&apos;s included:</h3>
          <ul className="text-play-800 space-y-2 text-sm">
            <li>✓ Run camps, clinics, and group training sessions</li>
            <li>✓ Offer 1-on-1 sessions families book against your calendar</li>
            <li>✓ Your programs listed in the public marketplace</li>
            <li>✓ Collect payments and track who owes what</li>
            <li>✓ Your own public trainer page</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
