/**
 * Live smoke of the configurable payment policy against the running dev
 * server (no Stripe account needed). Verifies over real HTTP:
 *   1. PLATFORM_COLLECT without a connected account → checkout blocked
 *      with ACCOUNT_NOT_READY (the new invariant).
 *   2. Platform-wide offline ban → record-cash blocked with
 *      OFFLINE_NOT_AVAILABLE; restored afterwards.
 *   3. Per-club override wins over the platform default.
 *
 *   npx tsx scripts/smoke-payment-policy.ts
 */

import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createParentWithChildren,
  createTryout,
  createWorldContext,
} from "@youthbasketballhub/test-worlds"
import { call, signIn, PASSWORD } from "./lib/test-helpers"

const SEED = 9413
let failures = 0

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  if (process.argv.includes("--wipe")) {
    await destroyWorld(createWorldContext(SEED))
    console.log("wiped")
    return
  }

  const world = await buildWorld({ seed: SEED, clubs: [{ teams: [{}] }] })
  const tenantId = world.clubs[0].tenantId
  const owner = world.clubs[0].owner
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  const tryout = await createTryout(world.ctx, { tenantId, fee: 25 })

  // Club chose PLATFORM_COLLECT but has NO connected account
  await prisma.paymentConfig.upsert({
    where: { tenantId },
    create: { tenantId, platformCollectAllowed: true, onlineMode: "PLATFORM_COLLECT" },
    update: {
      platformCollectAllowed: true,
      onlineMode: "PLATFORM_COLLECT",
      stripeAccountId: null,
      stripeAccountStatus: null,
      offlineAllowed: null,
      offlineEnabled: true,
    },
  })

  const jar = await signIn(family.parent.email, PASSWORD)
  if (!jar) throw new Error("sign-in failed — dev server running?")
  const signup = await call(`/api/tryouts/${tryout.id}/signup`, {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: family.players[0].id }),
  })
  const obligation = await prisma.paymentObligation.findUniqueOrThrow({
    where: {
      referenceType_referenceId: { referenceType: "TryoutSignup", referenceId: signup.body.id },
    },
  })

  // 1 — checkout must refuse PLATFORM_COLLECT without a transfer destination
  const checkout = await call(`/api/obligations/${obligation.id}/checkout`, {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  check(
    "platform-collect without connected account → ACCOUNT_NOT_READY",
    checkout.status === 400 && checkout.body.code === "ACCOUNT_NOT_READY",
    `got ${checkout.status} ${checkout.body.code ?? ""}`
  )

  // 2 — platform-wide offline ban blocks record-cash
  const prior = await prisma.platformSettings.findUnique({ where: { id: "default" } })
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabledCountries: ["CA"], payOfflineAllowed: false },
    update: { payOfflineAllowed: false },
  })
  const ownerJar = await signIn(owner.email, PASSWORD)
  if (!ownerJar) throw new Error("owner sign-in failed")
  const cashBanned = await call(`/api/obligations/${obligation.id}/payments`, {
    method: "POST",
    jar: ownerJar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 10, method: "CASH" }),
  })
  check(
    "platform-wide offline ban → OFFLINE_NOT_AVAILABLE",
    cashBanned.status === 400 && cashBanned.body.code === "OFFLINE_NOT_AVAILABLE",
    `got ${cashBanned.status} ${cashBanned.body.code ?? ""}`
  )

  // 3 — per-club override restores offline for this club only
  await prisma.paymentConfig.update({ where: { tenantId }, data: { offlineAllowed: true } })
  const cashAllowed = await call(`/api/obligations/${obligation.id}/payments`, {
    method: "POST",
    jar: ownerJar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 10, method: "CASH" }),
  })
  check(
    "per-club override beats the platform ban → cash recorded",
    cashAllowed.status === 201,
    `got ${cashAllowed.status} ${JSON.stringify(cashAllowed.body).slice(0, 80)}`
  )

  // restore platform policy
  await prisma.platformSettings.update({
    where: { id: "default" },
    data: { payOfflineAllowed: prior?.payOfflineAllowed ?? true },
  })

  console.log(failures === 0 ? "\nSMOKE PASSED" : `\nSMOKE FAILED (${failures})`)
  if (failures > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
