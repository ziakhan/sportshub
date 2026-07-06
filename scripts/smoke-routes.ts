/**
 * Route smoke test — the regression net the UX audit demanded: every key
 * page, fetched as every persona, must not 500. Catches "club pages have
 * been crashing for weeks and nobody opened one" (GAP-002) forever.
 *
 * Requires the dev server on :3000 and seeded test accounts.
 *   npx tsx scripts/smoke-routes.ts
 */

import { prisma } from "@youthbasketballhub/db"

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const PASSWORD = "TestPass123!"

async function login(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  const { csrfToken } = (await csrfRes.json()) as any
  const cookie = (csrfRes.headers.get("set-cookie") || "").split(";")[0]
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams({ csrfToken, email, password: PASSWORD, json: "true" }),
    redirect: "manual",
  })
  const cookies = res.headers.getSetCookie?.() ?? []
  const session = cookies.find((c: string) => c.includes("next-auth.session-token"))
  if (!session) throw new Error(`login failed for ${email}`)
  return `${cookie}; ${session.split(";")[0]}`
}

async function main() {
  // Live ids so dynamic routes get exercised with real data
  const season = await (prisma as any).season.findFirst({
    where: { status: "IN_PROGRESS", games: { some: { status: "COMPLETED" } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, leagueId: true },
  })
  const game = await (prisma as any).game.findFirst({
    where: { status: "COMPLETED", seasonId: season?.id },
    select: { id: true, homeTeamId: true },
  })
  const stat = game
    ? await (prisma as any).playerStat.findFirst({ where: { gameId: game.id }, select: { playerId: true } })
    : null
  const club = await (prisma as any).tenant.findFirst({
    where: { status: { in: ["ACTIVE", "UNCLAIMED"] }, teams: { some: {} } },
    select: { slug: true },
  })
  const post = await (prisma as any).post.findFirst({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  })
  const ownedTenant = await (prisma as any).userRole.findFirst({
    where: { role: "ClubOwner", user: { email: "owner@sportshub.test" } },
    select: { tenantId: true },
  })

  const PUBLIC: string[] = [
    "/", "/scores", "/leagues", "/news", "/club", "/events", "/marketplace",
    "/for-clubs", "/for-leagues",
    ...(season ? [`/league/${season.id}`, `/league/${season.id}/leaders`] : []),
    ...(game ? [`/live/${game.id}`, `/team/${game.homeTeamId}`] : []),
    ...(stat ? [`/player/${stat.playerId}`] : []),
    ...(club ? [`/club/${club.slug}`] : []),
    ...(post ? [`/news/${post.slug}`] : []),
  ]

  const PERSONAS: Array<{ email: string | null; label: string; routes: string[] }> = [
    { email: null, label: "anonymous", routes: PUBLIC },
    {
      email: "parent@sportshub.test",
      label: "parent",
      routes: ["/", "/dashboard", "/players", "/offers", "/payments", "/notifications", "/settings/profile"],
    },
    {
      email: "owner@sportshub.test",
      label: "club-owner",
      routes: [
        "/dashboard",
        ...(ownedTenant
          ? [
              `/clubs/${ownedTenant.tenantId}`,
              `/clubs/${ownedTenant.tenantId}/teams`,
              `/clubs/${ownedTenant.tenantId}/tryouts`,
              `/clubs/${ownedTenant.tenantId}/offers`,
              `/clubs/${ownedTenant.tenantId}/payments`,
              `/clubs/${ownedTenant.tenantId}/staff`,
            ]
          : []),
        "/browse-leagues",
        "/score",
      ],
    },
    {
      email: "league@sportshub.test",
      label: "league-owner",
      routes: ["/dashboard", "/manage/leagues", "/manage/leagues/create", "/score"],
    },
    {
      email: "referee@sportshub.test",
      label: "referee",
      routes: ["/dashboard", "/referee/profile", "/score", ...(game ? [`/scoresheet/${game.id}`] : [])],
    },
    {
      email: "player@sportshub.test",
      label: "player",
      routes: ["/dashboard", "/teams", "/players", "/scores"],
    },
    {
      email: "admin@sportshub.test",
      label: "platform-admin",
      routes: ["/dashboard", "/dashboard/admin/users", "/dashboard/admin/payments", "/dashboard/admin/settings"],
    },
  ]

  let failures = 0
  let checks = 0
  for (const persona of PERSONAS) {
    let cookie = ""
    try {
      cookie = persona.email ? await login(persona.email) : ""
    } catch (err) {
      console.error(`✗ [${persona.label}] LOGIN FAILED: ${err}`)
      failures++
      continue
    }
    for (const route of persona.routes) {
      checks++
      const res = await fetch(`${BASE}${route}`, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
      })
      const ok = res.status < 500
      if (!ok) {
        failures++
        console.error(`✗ [${persona.label}] ${route} -> ${res.status}`)
      } else if (process.env.VERBOSE) {
        console.log(`✓ [${persona.label}] ${route} -> ${res.status}`)
      }
    }
    console.log(`[${persona.label}] done (${persona.routes.length} routes)`)
  }

  console.log(`\n${checks} checks, ${failures} failures`)
  await (prisma as any).$disconnect()
  if (failures > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
