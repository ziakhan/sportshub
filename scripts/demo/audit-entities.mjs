// Sweep v4: enumerate EVERY public entity page from the index pages and
// flag both hard 404s and SOFT 404s (HTTP 200 whose body renders the
// custom "Page not found" screen or an empty error state).
const BASE = "https://sportshubone.com"
const INDEXES = ["/club", "/leagues", "/scores", "/news", "/events", "/marketplace", "/for-clubs", "/"]
const PATTERNS = [/^\/club\//, /^\/league\//, /^\/leagues\//, /^\/team\//, /^\/player\//, /^\/p\//, /^\/live\//, /^\/news\//, /^\/tryout\//, /^\/house-league\//, /^\/camp\//, /^\/tournament\//, /^\/events\//, /^\/marketplace\//]
const linkRe = /href="(\/[^"#?]*)(?:[?#][^"]*)?"/g
const targets = new Set()
for (const idx of INDEXES) {
  const res = await fetch(BASE + idx, { headers: { "user-agent": "sportshub-audit" } }).catch(() => null)
  if (!res || res.status !== 200) { console.log("INDEX BROKEN:", idx, res && res.status); continue }
  const html = await res.text()
  let m
  while ((m = linkRe.exec(html))) {
    const href = m[1]
    if (PATTERNS.some((p) => p.test(href))) targets.add(href)
  }
}
// second hop: from each club page, collect team/tryout links too
for (const t of [...targets].filter((u) => u.startsWith("/club/")).slice(0, 60)) {
  const res = await fetch(BASE + t).catch(() => null)
  if (!res || res.status !== 200) continue
  const html = await res.text()
  let m
  while ((m = linkRe.exec(html))) {
    const href = m[1]
    if (PATTERNS.some((p) => p.test(href))) targets.add(href)
  }
}
console.log(`checking ${targets.size} entity pages...`)
const bad = []
let n = 0
for (const u of targets) {
  n++
  const res = await fetch(BASE + u, { headers: { "user-agent": "sportshub-audit" } }).catch(() => null)
  if (!res) { bad.push(["FETCH-ERR", u]); continue }
  if (res.status >= 400) { bad.push([res.status, u]); continue }
  if (res.status === 200) {
    const html = await res.text()
    if (/Page not found|This page could not be found/.test(html)) bad.push(["SOFT-404", u])
    else if (/Application error|Something went wrong/.test(html)) bad.push(["CLIENT-ERR", u])
  }
  if (n % 100 === 0) console.log(`  ...${n}`)
  await new Promise((r) => setTimeout(r, 40))
}
console.log(`done: ${targets.size} pages checked, ${bad.length} broken`)
for (const [s, u] of bad) console.log(s, u)
