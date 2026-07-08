import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionUserId } from "@/lib/auth-helpers"
import { PaymentMethodsManager } from "@/components/payments/payment-methods-manager"

export const dynamic = "force-dynamic"

/**
 * "Payment methods" — the family's saved cards. Cards live in Stripe's
 * vault; a default card is what installment plans auto-charge (payments v2).
 */
export default async function PaymentMethodsPage() {
  const auth = await getSessionUserId()
  if (!auth) redirect("/sign-in?callbackUrl=/settings/payments")

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-ink-900 text-xl font-bold md:text-2xl">Payment methods</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Save a card for registration fees and payment plans. Your card is stored securely by
          Stripe — we never see the full number. See what you owe on{" "}
          <Link href="/payments" className="text-play-600 font-semibold hover:underline">
            My payments
          </Link>
          .
        </p>
      </div>
      <PaymentMethodsManager />
    </div>
  )
}
