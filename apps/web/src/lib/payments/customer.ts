import { prisma } from "@youthbasketballhub/db"
import { getStripe } from "./stripe"

/**
 * The user's Stripe Customer on the PLATFORM account — where saved cards
 * live (Stripe's vault). Created lazily the first time a card is added or a
 * payment is made. Cards attached here work for destination charges; direct
 * charges save the card on the club's connected account instead (stage E).
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, stripeCustomerId: true },
  })
  if (!user) throw new Error("User not found")
  if (user.stripeCustomerId) return user.stripeCustomerId

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    metadata: { userId: user.id },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })
  return customer.id
}

export interface SavedCard {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

/** The user's saved cards (display fields only — never the PAN). */
export async function listSavedCards(userId: string): Promise<SavedCard[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId) return []

  const stripe = getStripe()
  const [methods, customer] = await Promise.all([
    stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card" }),
    stripe.customers.retrieve(user.stripeCustomerId),
  ])
  const defaultId =
    !("deleted" in customer) &&
    (customer.invoice_settings?.default_payment_method as string | null | undefined)

  return methods.data.map((m) => ({
    id: m.id,
    brand: m.card?.brand ?? "card",
    last4: m.card?.last4 ?? "••••",
    expMonth: m.card?.exp_month ?? 0,
    expYear: m.card?.exp_year ?? 0,
    isDefault: m.id === defaultId,
  }))
}

/** Confirm a payment method belongs to this user's customer (authz guard). */
export async function ownsPaymentMethod(userId: string, paymentMethodId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId) return null
  const stripe = getStripe()
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  return pm.customer === user.stripeCustomerId ? user.stripeCustomerId : null
}
