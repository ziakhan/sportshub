import { prisma } from "@youthbasketballhub/db"
import { call, signIn, PASSWORD } from "./lib/test-helpers"

async function main() {
  // The live-verification world (seed 9412) has a club owner + a parent with a PAID obligation
  const ob = await prisma.paymentObligation.findFirstOrThrow({
    where: { status: "PAID", payeeTenantId: { not: null } },
    include: { payerUser: true, payeeTenant: true },
    orderBy: { createdAt: "desc" },
  })
  const owner = await prisma.userRole.findFirstOrThrow({
    where: { tenantId: ob.payeeTenantId!, role: "ClubOwner" },
    include: { user: true },
  })

  const checks: [string, string, string, string][] = [
    [owner.user.email, `/clubs/${ob.payeeTenantId}/payments`, "Owed to", "club payments"],
    [ob.payerUser!.email, "/payments", "My payments", "payer page"],
  ]

  // Any league with an owner (sim world) for the league payments page
  const league = await prisma.league.findFirst()
  if (league) {
    const leagueOwner = await prisma.user.findUnique({ where: { id: league.ownerId } })
    if (leagueOwner) {
      checks.push([leagueOwner.email, `/leagues/${league.id}/payments`, "Team fees", "league payments"])
    }
  }

  let fail = 0
  for (const [email, path, needle, label] of checks) {
    const jar = await signIn(email, PASSWORD)
    if (!jar) { console.log(`❌ ${label}: sign-in failed for ${email}`); fail++; continue }
    const res = await call(path, { jar })
    const ok = res.status === 200 && String(res.body).includes(needle)
    console.log(`${ok ? "✅" : "❌"} ${label}: ${res.status} ${ok ? "" : "(missing '" + needle + "')"}`)
    if (!ok) fail++
  }
  process.exitCode = fail ? 1 : 0
}
main().finally(() => prisma.$disconnect())
