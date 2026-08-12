// Parent-child linking arc smokes (owner rulings 2026-08-12). HTTP only,
// throwaway accounts, cleaned up at the end. Covers: optional-handle
// onboarding, the guardian invite to a fresh email, both money-gate answers
// (no guardian / routed to guardian), the dashboard nudge audience, the
// invite-to-a-brand-new-parent journey, and the claim-and-merge path.
//
// Run from the REPO ROOT (it uses the root node_modules and prisma/.env):
//   node scripts/demo/smoke-family-linking.mjs
// Env: BASE_URL, MAILPIT_URL, DEMO_PARENT.
import { config } from "dotenv"
config({ path: "prisma/.env" })
const { PrismaClient } = await import("@prisma/client")

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025"
const PASS = "TestPass123!"
const STAMP = Date.now()
const prisma = new PrismaClient()

const results = []
const ok = (name, pass, extra = "") => {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`)
}

function jar() {
  const cookies = new Map()
  return {
    absorb(res) {
      const set = res.headers.getSetCookie ? res.headers.getSetCookie() : []
      for (const c of set) {
        const kv = c.split(";")[0]
        const i = kv.indexOf("=")
        cookies.set(kv.slice(0, i), kv.slice(i + 1))
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
    },
  }
}

async function req(j, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie: j.header() },
    redirect: "manual",
  })
  j.absorb(res)
  return res
}

async function signIn(email) {
  const j = jar()
  const csrfRes = await req(j, "/api/auth/csrf")
  const { csrfToken } = await csrfRes.json()
  await req(j, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password: PASS, json: "true" }),
  })
  const s = await (await req(j, "/api/auth/session")).json()
  if (!s?.user?.id) throw new Error(`sign-in failed for ${email}`)
  return { jar: j, userId: s.user.id }
}

async function signUp(email, firstName, lastName) {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASS, firstName, lastName }),
  })
  if (!res.ok) throw new Error(`signup failed for ${email}: ${await res.text()}`)
  return signIn(email)
}

async function onboardPlayer(session, birthYear) {
  return req(session.jar, "/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roles: ["Player"],
      profileData: {
        type: "Player",
        country: "CA",
        dateOfBirth: `${birthYear}-03-15`,
        gender: "MALE",
        city: "Toronto",
        state: "ON",
      },
    }),
  })
}

const createdEmails = []
let createdObligationId = null

async function main() {
  const minorBirthYear = new Date().getFullYear() - 15

  // ---------------------------------------------------------------- (a)
  const kidEmail = `smoke-kid-${STAMP}@smoke.test`
  createdEmails.push(kidEmail)
  const kid = await signUp(kidEmail, "Smoketest", `Kid${STAMP}`)
  const reserved = (await (await req(kid.jar, "/api/account/handle")).json())?.handle ?? null
  const onboardRes = await onboardPlayer(kid, minorBirthYear)
  const afterHandle = (await (await req(kid.jar, "/api/account/handle")).json())?.handle ?? null
  const players = await (await req(kid.jar, "/api/players")).json()
  const kidPlayerId = players?.players?.[0]?.id ?? null
  ok(
    "(a) 2-step onboarding completes with the handle left empty",
    onboardRes.status === 200 && !!kidPlayerId && afterHandle === reserved && !!reserved,
    `status=${onboardRes.status} handle=${afterHandle} player=${kidPlayerId ? "created" : "missing"}`
  )

  // ---------------------------------------------------------------- (d)
  // The banner is a client component that mounts after checking the
  // session-dismiss key, so the server HTML carries its chunk rather than its
  // words. Presence of the chunk is what "the dashboard shipped the nudge"
  // means here.
  const kidDash = await (await req(kid.jar, "/dashboard")).text()
  const kidSeesNudge = kidDash.includes("link-parent-banner") && kidDash.includes(kidPlayerId)
  const parent = await signIn(process.env.DEMO_PARENT ?? "guardian-001@sportshub.demo")
  const parentDash = await (await req(parent.jar, "/dashboard")).text()
  const parentSeesNudge = parentDash.includes("link-parent-banner")
  ok(
    "(d) nudge banner renders for an unlinked self-owned 13+ and not for a parent",
    kidSeesNudge && !parentSeesNudge,
    `kid=${kidSeesNudge} parent=${parentSeesNudge}`
  )

  // ------------------------------------------------- (c1) no guardian yet
  const tenant = await prisma.tenant.findFirst({ select: { id: true, currency: true } })
  const obligation = await prisma.paymentObligation.create({
    data: {
      payerUserId: kid.userId,
      payeeTenantId: tenant.id,
      referenceType: "TryoutSignup",
      referenceId: `smoke-${STAMP}`,
      description: `Smoke tryout fee ${STAMP}`,
      amount: 75,
      currency: tenant.currency ?? "CAD",
    },
  })
  createdObligationId = obligation.id
  const unlinkedPay = await req(kid.jar, `/api/obligations/${obligation.id}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  const unlinkedBody = await unlinkedPay.json().catch(() => ({}))
  ok(
    "(c1) money gate with no guardian walks the minor into the invite",
    unlinkedPay.status === 409 && unlinkedBody.needsGuardian === true && !!unlinkedBody.playerId,
    `status=${unlinkedPay.status} code=${unlinkedBody.code}`
  )

  // ---------------------------------------------------------------- (b)
  const guardianEmail = `smoke-parent-${STAMP}@smoke.test`
  createdEmails.push(guardianEmail)
  const inviteRes = await req(kid.jar, "/api/family-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "GUARDIAN", playerId: kidPlayerId, email: guardianEmail }),
  })
  const invite = await prisma.familyInvitation.findFirst({
    where: { invitedEmail: guardianEmail },
    select: { token: true, type: true },
  })
  let mailHit = false
  try {
    const mail = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(guardianEmail)}`)).json()
    mailHit = (mail?.messages_count ?? mail?.total ?? 0) > 0
  } catch {
    mailHit = false
  }
  ok(
    "(b) guardian invite to a fresh email creates the invite and emails it",
    inviteRes.status === 201 && invite?.type === "GUARDIAN" && mailHit,
    `status=${inviteRes.status} type=${invite?.type} mailpit=${mailHit}`
  )

  // ------------------------------------- (f) invite to a brand-new parent
  const newParent = await signUp(guardianEmail, "Smoke", `Parent${STAMP}`)
  const pendingForParent = await (await req(newParent.jar, "/api/family-invitations")).json()
  const acceptRes = await req(newParent.jar, `/api/family-invitations/${invite.token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "accept" }),
  })
  const acceptBody = await acceptRes.json().catch(() => ({}))
  const linkedPlayer = await prisma.player.findUnique({
    where: { id: kidPlayerId },
    select: { parentId: true, userId: true },
  })
  ok(
    "(f) a parent with no account signs up through the invite and the link lands",
    acceptRes.status === 200 &&
      acceptBody.status === "ACCEPTED" &&
      linkedPlayer.parentId === newParent.userId &&
      linkedPlayer.userId === kid.userId &&
      (pendingForParent?.invitations ?? []).length > 0,
    `accept=${acceptRes.status} pendingSeen=${(pendingForParent?.invitations ?? []).length}`
  )

  // ----------------------------------------------- (c2) guardian attached
  const linkedPay = await req(kid.jar, `/api/obligations/${obligation.id}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  const linkedBody = await linkedPay.json().catch(() => ({}))
  const reassigned = await prisma.paymentObligation.findUnique({
    where: { id: obligation.id },
    select: { payerUserId: true },
  })
  const parentNotified = await prisma.notification.count({
    where: { userId: newParent.userId, type: "payment_approval_request" },
  })
  ok(
    "(c) money gate routes a minor's payable action to the linked parent",
    linkedPay.status === 202 &&
      linkedBody.routedToParent === true &&
      reassigned.payerUserId === newParent.userId &&
      parentNotified > 0,
    `status=${linkedPay.status} payer=${reassigned.payerUserId === newParent.userId ? "parent" : "kid"} notifications=${parentNotified}`
  )

  // ------------------------------------------------------- (e) the claim
  const claimParentEmail = `smoke-claimparent-${STAMP}@smoke.test`
  const claimKidEmail = `smoke-claimkid-${STAMP}@smoke.test`
  createdEmails.push(claimParentEmail, claimKidEmail)
  const claimParent = await signUp(claimParentEmail, "Claim", `Parent${STAMP}`)
  const existingPlayer = await prisma.player.create({
    data: {
      firstName: "Claimee",
      lastName: `Kid${STAMP}`,
      dateOfBirth: new Date(`${minorBirthYear}-09-02`),
      gender: "MALE",
      parentId: claimParent.userId,
      isMinor: false,
      canLogin: false,
    },
  })
  const claimKid = await signUp(claimKidEmail, "Claimee", `Kid${STAMP}`)
  await onboardPlayer(claimKid, minorBirthYear)
  const claimKidPlayers = await (await req(claimKid.jar, "/api/players")).json()
  const dupPlayerId = claimKidPlayers?.players?.[0]?.id
  const claimReq = await req(claimKid.jar, "/api/family-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "GUARDIAN",
      playerId: dupPlayerId,
      email: claimParentEmail,
      preferClaim: true,
    }),
  })
  const claimInvite = await prisma.familyInvitation.findFirst({
    where: { invitedEmail: claimParentEmail },
    select: { token: true, type: true, targetPlayerId: true },
  })
  const claimAccept = await req(claimParent.jar, `/api/family-invitations/${claimInvite.token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "accept" }),
  })
  const claimBody = await claimAccept.json().catch(() => ({}))
  const survivor = await prisma.player.findUnique({
    where: { id: existingPlayer.id },
    select: { userId: true, canLogin: true },
  })
  const absorbed = await prisma.player.findUnique({
    where: { id: dupPlayerId },
    select: { userId: true, deletedAt: true, absorbedIntoPlayerId: true },
  })
  ok(
    "(e) claim request links the kid's login to the parent's existing player",
    claimReq.status === 201 &&
      claimInvite.type === "CHILD_CLAIM" &&
      claimInvite.targetPlayerId === existingPlayer.id &&
      claimAccept.status === 200 &&
      claimBody.merged === true &&
      survivor.userId === claimKid.userId &&
      survivor.canLogin === true &&
      absorbed.userId === null &&
      absorbed.absorbedIntoPlayerId === existingPlayer.id &&
      !!absorbed.deletedAt,
    `type=${claimInvite.type} accept=${claimAccept.status} merged=${claimBody.merged}`
  )
}

try {
  await main()
} catch (e) {
  console.error("SMOKE ERROR:", e)
  results.push({ name: "run", pass: false })
} finally {
  if (createdObligationId) {
    await prisma.payment.deleteMany({ where: { obligationId: createdObligationId } }).catch(() => {})
    await prisma.paymentObligation.delete({ where: { id: createdObligationId } }).catch(() => {})
  }
  for (const email of createdEmails) {
    await prisma.user.deleteMany({ where: { email } }).catch((e) => console.error("cleanup", email, e.message))
  }
  await prisma.$disconnect()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed === 0 ? 0 : 1)
}
