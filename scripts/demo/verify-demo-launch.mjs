/**
 * End-to-end drive of the limited-launch demo experience (phases 1a-2e):
 * anonymous browse w/ Preview section → live demo game public → throwaway
 * signup → enter parent persona → banner renders → ghost chat replies →
 * non-whitelisted mutation blocked 409 → exit demo. Pure fetch, no browser.
 *
 *   node scripts/demo/verify-demo-launch.mjs
 */
const BASE = process.env.BASE || "http://localhost:3000"
let pass = 0
let fail = 0

function check(name, ok, extra = "") {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

function cookiesFrom(res, jar) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  for (const c of set) {
    const [pair] = c.split(";")
    const [k, v] = pair.split("=")
    if (v === "" || /Max-Age=0/i.test(c)) delete jar[k]
    else jar[k] = v
  }
  return jar
}

function header(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
}

async function main() {
  // 1. Anonymous browse
  const leagues = await fetch(`${BASE}/leagues`)
  const leaguesHtml = await leagues.text()
  check("/leagues renders", leagues.ok)
  check("Preview section present", leaguesHtml.includes("Explore the demo league"))
  check("Demo league listed", leaguesHtml.includes("Maple Court League"))

  // 2. Live demo game public, no login
  const liveList = await fetch(`${BASE}/api/demo-drive/none`).catch(() => null) // noop warm
  const liveId = process.argv[2] || process.env.LIVE_GAME_ID
  if (liveId) {
    const live = await fetch(`${BASE}/live/${liveId}`)
    const liveHtml = await live.text()
    check("live game page public", live.ok)
    check("live page carries Preview badge", liveHtml.includes("Preview"))
  } else {
    console.log("  - (no LIVE_GAME_ID given, skipping live page check)")
  }

  // 3. Throwaway signup
  const email = `demo-drive-${Date.now()}@example.com`
  const jar = {}
  const signup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "TestPass123!",
      firstName: "Drive",
      lastName: "Test",
    }),
  })
  check("signup", signup.ok, String(signup.status))

  // 4. Sign in (NextAuth credentials, probe.mjs recipe)
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  cookiesFrom(csrfRes, jar)
  const { csrfToken } = await csrfRes.json()
  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: header(jar) },
    body: new URLSearchParams({ csrfToken, email, password: "TestPass123!", json: "true" }),
    redirect: "manual",
  })
  cookiesFrom(login, jar)
  const session = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: header(jar) } })
  const sessionData = await session.json().catch(() => ({}))
  check("session minted", !!sessionData?.user, JSON.stringify(sessionData).slice(0, 80))

  // 5. Enter parent persona
  const enter = await fetch(`${BASE}/api/demo/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: header(jar) },
    body: JSON.stringify({ persona: "parent" }),
  })
  cookiesFrom(enter, jar)
  const enterData = await enter.json().catch(() => ({}))
  check("enter parent persona", enter.ok && enterData.ok, String(enter.status))
  check("demo-view cookie set", !!jar["demo-view"])

  // 6. Banner renders on a platform page as the persona
  const dash = await fetch(`${BASE}/dashboard`, { headers: { cookie: header(jar) }, redirect: "manual" })
  const dashHtml = dash.status === 200 ? await dash.text() : ""
  check(
    "demo banner on dashboard",
    dash.status === 200 && dashHtml.includes("exploring the demo"),
    `status=${dash.status}`
  )

  // 7. Ghost chat: send, wait past the ghost delay, expect a coach reply
  const teamId = process.env.CHAT_TEAM_ID
  if (teamId) {
    const sendMsg = await fetch(`${BASE}/api/demo/action/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: header(jar) },
      body: JSON.stringify({ targetId: teamId, text: "Are we still on for Saturday?" }),
    })
    check("demo chat send", sendMsg.ok, String(sendMsg.status))
    await new Promise((r) => setTimeout(r, 9000))
    const overlay = await fetch(`${BASE}/api/demo/action/chat?targetId=${teamId}`, {
      headers: { cookie: header(jar) },
    })
    const od = await overlay.json().catch(() => ({}))
    const coach = (od.messages ?? []).filter((m) => m.kind === "coach")
    check("ghost coach replied", coach.length >= 1, JSON.stringify(od).slice(0, 120))
  } else {
    console.log("  - (no CHAT_TEAM_ID given, skipping ghost chat)")
  }

  // 8. Non-whitelisted mutation blocked
  const blocked = await fetch(`${BASE}/api/teams/whatever/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: header(jar) },
    body: JSON.stringify({ body: "should be blocked" }),
  })
  const blockedData = await blocked.json().catch(() => ({}))
  check("mutation blocked with 409 {demo:true}", blocked.status === 409 && blockedData.demo === true, String(blocked.status))

  // 9. Exit demo
  const exit = await fetch(`${BASE}/api/demo/exit`, { method: "POST", headers: { cookie: header(jar) } })
  cookiesFrom(exit, jar)
  check("exit demo", exit.ok && !jar["demo-view"])

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
