// Crawl the live site and report every non-200 page (owner: "the website
// is currently broken, do a full audit"). Read-only GETs, same origin,
// BFS 2 levels from the key entry pages.
const BASE = process.argv[2] || "https://sportshubone.com"
const seeds = ["/", "/for-clubs", "/for-leagues", "/for-parents", "/scores", "/news", "/events", "/leagues", "/club", "/marketplace", "/how-it-works", "/sign-in", "/sign-up"]
const seen = new Map()
const queue = seeds.map((u) => ({ url: u, depth: 0, from: "(seed)" }))
const bad = []
const linkRe = /href="(\/[^"#?]*)(?:[?#][^"]*)?"/g

while (queue.length) {
  const { url, depth, from } = queue.shift()
  if (seen.has(url)) continue
  seen.set(url, true)
  if (seen.size > 220) break
  let res
  try {
    res = await fetch(BASE + url, { redirect: "manual", headers: { "user-agent": "sportshub-audit" } })
  } catch (e) {
    bad.push([url, "FETCH-ERR", from])
    continue
  }
  const status = res.status
  if (status >= 400) bad.push([url, status, from])
  if (status >= 300 && status < 400) {
    const loc = res.headers.get("location") || ""
    if (loc.includes("/sign-in")) continue // auth-gated, fine
    continue
  }
  if (status === 200 && depth < 2 && (res.headers.get("content-type") || "").includes("text/html")) {
    const html = await res.text()
    // detect soft 404s: next.js not-found rendered with 200? (App router 404 returns 404, but check text)
    if (/This page could not be found|NEXT_NOT_FOUND/.test(html)) bad.push([url, "SOFT-404", from])
    let m
    const links = new Set()
    while ((m = linkRe.exec(html))) {
      const href = m[1]
      if (href.startsWith("/_next") || href.startsWith("/shots") || href.match(/\.(png|jpg|svg|ico|css|js|webmanifest)$/)) continue
      links.add(href)
    }
    for (const l of links) if (!seen.has(l)) queue.push({ url: l, depth: depth + 1, from: url })
  }
  await new Promise((r) => setTimeout(r, 60))
}

console.log(`crawled ${seen.size} URLs on ${BASE}`)
if (!bad.length) console.log("NO broken pages found")
for (const [u, s, f] of bad) console.log(`${s}  ${u}   (linked from ${f})`)
