/**
 * QA setup for payments v2 (H1/H2 verification). Creates a FULLY-ACTIVATED
 * test Stripe connected account (card_payments + transfers) and a self-
 * contained test world (tenant/owner/parent/player/team + an installment
 * offer). Prints IDs so the curl driver can run the real accept→charge loop.
 *
 * Run:  MODE=PLATFORM_COLLECT npx tsx scripts/qa-payments-setup.ts
 *       MODE=CONNECT_DIRECT   npx tsx scripts/qa-payments-setup.ts
 */
import { prisma } from "@youthbasketballhub/db"
import Stripe from "stripe"
import { hash } from "bcryptjs"

const SK = process.env.STRIPE_SECRET_KEY!
const MODE = (process.env.MODE || "PLATFORM_COLLECT") as "PLATFORM_COLLECT" | "CONNECT_DIRECT"
const stripe = new Stripe(SK, { apiVersion: "2023-10-16" as any })

async function activatedAccount(): Promise<string> {
  const acct = await stripe.accounts.create({
    type: "custom",
    country: "US",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: { url: "https://qa-testclub.org", mcc: "8299" },
    individual: {
      first_name: "Test",
      last_name: "Club",
      email: "qa-club@example.com",
      phone: "0000000000",
      ssn_last_4: "0000",
      id_number: "000000000",
      dob: { day: 1, month: 1, year: 1990 },
      address: {
        line1: "address_full_match",
        city: "South San Francisco",
        state: "CA",
        postal_code: "94080",
      },
    },
    tos_acceptance: { date: 1609459200, ip: "127.0.0.1" },
    external_account: {
      object: "bank_account",
      country: "US",
      currency: "usd",
      routing_number: "110000000",
      account_number: "000123456789",
    } as any,
  })
  const fresh = await stripe.accounts.retrieve(acct.id)
  console.log(
    `  account ${acct.id}: charges_enabled=${fresh.charges_enabled} card_payments=${fresh.capabilities?.card_payments} transfers=${fresh.capabilities?.transfers}`
  )
  return acct.id
}

async function main() {
  const tag = `qa-${Date.now()}`
  console.log(`Creating activated connected account (${MODE})…`)
  const accountId = await activatedAccount()

  const passwordHash = await hash("TestPass123!", 10)
  const owner = await prisma.user.create({
    data: { email: `${tag}-owner@qa.test`, passwordHash, firstName: "QA", lastName: "Owner", onboardedAt: new Date() },
  })
  const tenant = await prisma.tenant.create({
    data: { name: `QA Club ${tag}`, slug: tag, status: "ACTIVE", country: "US", currency: "USD" },
  })
  await prisma.userRole.create({ data: { userId: owner.id, role: "ClubOwner", tenantId: tenant.id } })
  await (prisma as any).paymentConfig.create({
    data: {
      tenantId: tenant.id,
      onlineMode: MODE,
      stripeAccountId: accountId,
      stripeAccountStatus: "active",
      reminderLeadDays: 3,
    },
  })
  const team = await prisma.team.create({
    data: { tenantId: tenant.id, name: `QA Team ${tag}`, ageGroup: "U14", season: "QA" },
  })

  const parent = await prisma.user.create({
    data: { email: `${tag}-parent@qa.test`, passwordHash, firstName: "QA", lastName: "Parent", onboardedAt: new Date() },
  })
  const player = await prisma.player.create({
    data: {
      firstName: "Kid",
      lastName: tag,
      parentId: parent.id,
      dateOfBirth: new Date(2012, 0, 1),
      gender: "MALE",
      isMinor: true,
    },
  })

  // Offer: $1,000 fee, plan = $250 deposit + 2 × $375, due dates already past
  const past1 = new Date(Date.now() - 2 * 86_400_000)
  const past2 = new Date(Date.now() - 1 * 86_400_000)
  const offer = await (prisma as any).offer.create({
    data: {
      teamId: team.id,
      playerId: player.id,
      status: "PENDING",
      seasonFee: 1000,
      installments: 3,
      includesUniform: true,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
    select: { id: true },
  })
  const option = await (prisma as any).offerOption.create({
    data: {
      offerId: offer.id,
      label: "QA Plan",
      seasonFee: 1000,
      installments: 3,
      includesUniform: true,
      sortOrder: 0,
      allowFullPay: true,
      allowInstallments: true,
      depositAmount: 250,
      installmentTerms: {
        create: [
          { sequence: 1, amount: 375, dueDate: past1 },
          { sequence: 2, amount: 375, dueDate: past2 },
        ],
      },
    },
    select: { id: true },
  })

  console.log("\n=== QA SCENARIO READY ===")
  console.log(JSON.stringify({
    mode: MODE,
    accountId,
    tenantId: tenant.id,
    parentEmail: parent.email,
    offerId: offer.id,
    optionId: option.id,
  }, null, 2))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
