/**
 * Self-cleaning E2E test for action-driven implicit role grants.
 *
 * Verifies that an arbitrary authenticated user (no roles, fresh signup) can:
 *   - Add a child         -> Parent role granted implicitly
 *   - Create a league     -> LeagueOwner role granted (scoped to the league)
 *   - Become a referee    -> Referee role granted + RefereeProfile created
 *
 * Creates a throwaway user, exercises the live HTTP routes, asserts the roles
 * landed in the DB, then deletes everything it created. Idempotent.
 *
 * Run: cd packages/db && npx tsx ../../scripts/test-role-actions.ts
 */
import { prisma } from "@youthbasketballhub/db"
import { signup, signIn, call } from "./lib/test-helpers"

const EMAIL = "role-actions-test@roleactions.local"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } })
  if (!user) return
  const uid = user.id
  await prisma.userRole.deleteMany({ where: { userId: uid } })
  await prisma.refereeProfile.deleteMany({ where: { userId: uid } })
  await prisma.player.deleteMany({ where: { parentId: uid } })
  await (prisma as any).league.deleteMany({ where: { ownerId: uid } })
  await prisma.user.delete({ where: { id: uid } })
}

async function main() {
  console.log("Cleaning any prior run…")
  await cleanup()

  console.log("Signing up a fresh, role-less user…")
  await signup(EMAIL, "Role", "Actions")
  const jar = await signIn(EMAIL, "TestPass123!")
  if (!jar) throw new Error("sign-in failed")

  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } })
  if (!user) throw new Error("user not found after signup")
  const uid = user.id

  const startingRoles = await prisma.userRole.count({ where: { userId: uid } })
  check("fresh user starts with no roles", startingRoles === 0, `had ${startingRoles}`)

  // ---- Add a child -> Parent ----
  console.log("\nAction: Add a child")
  const addChild = await call("/api/players", {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Kid",
      lastName: "Actions",
      dateOfBirth: "2011-05-01", // ~14 yrs — no consent needed
      gender: "MALE",
    }),
  })
  check("POST /api/players -> 201", addChild.status === 201, `got ${addChild.status}`)
  const parentRole = await prisma.userRole.findFirst({ where: { userId: uid, role: "Parent" } })
  check("Parent role granted implicitly", !!parentRole)

  // Adding a second child should NOT create a duplicate Parent role
  await call("/api/players", {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Kid2",
      lastName: "Actions",
      dateOfBirth: "2012-05-01",
      gender: "FEMALE",
    }),
  })
  const parentCount = await prisma.userRole.count({ where: { userId: uid, role: "Parent" } })
  check("no duplicate Parent role after 2nd child", parentCount === 1, `count=${parentCount}`)

  // ---- Create a league -> LeagueOwner (scoped) ----
  console.log("\nAction: Create a league")
  const createLeague = await call("/api/leagues", {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Role Actions Test League" }),
  })
  check("POST /api/leagues -> 201 (no pre-role needed)", createLeague.status === 201, `got ${createLeague.status}`)
  const leagueId = createLeague.body?.id
  const leagueRole = await prisma.userRole.findFirst({
    where: { userId: uid, role: "LeagueOwner", leagueId: leagueId },
  })
  check("LeagueOwner role granted, scoped to the new league", !!leagueRole)

  // ---- Become a referee -> Referee + profile ----
  console.log("\nAction: Become a referee")
  const becomeRef = await call("/api/referee/profile", {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      certificationLevel: "Level 1",
      standardFee: 50,
      availableRegions: ["Toronto", "Mississauga"],
    }),
  })
  check("POST /api/referee/profile -> 201", becomeRef.status === 201, `got ${becomeRef.status}`)
  const refRole = await prisma.userRole.findFirst({ where: { userId: uid, role: "Referee" } })
  check("Referee role granted", !!refRole)
  const refProfile = await prisma.refereeProfile.findUnique({ where: { userId: uid } })
  check("RefereeProfile created", !!refProfile)

  // Second become-referee should 409 (already a referee)
  const becomeRefAgain = await call("/api/referee/profile", {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      certificationLevel: "Level 2",
      standardFee: 60,
      availableRegions: ["Toronto"],
    }),
  })
  check("second become-referee -> 409", becomeRefAgain.status === 409, `got ${becomeRefAgain.status}`)

  console.log("\nCleaning up…")
  await cleanup()

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await cleanup().catch(() => {})
  process.exit(1)
})
