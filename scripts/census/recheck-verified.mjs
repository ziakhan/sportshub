// V3 corrected (2026-08-20): the verified-contacts sheet keys are
// club,city,website,kind,value — the source page IS the website column and
// the contact is a kind/value pair. The first sweep looked for a column
// literally named source/url and wrongly scored all 76 as SOURCE GONE.
import { readFileSync, writeFileSync } from "fs"

const ROOT = new URL("../..", import.meta.url).pathname

function parseCsv(text) {
  const rows = []
  let row = [], field = "", inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c !== "\r") field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const header = rows.shift()
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])))
}
const csvEscape = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""))

const rows = parseCsv(readFileSync(ROOT + "docs/club-contacts-verified-2026-08-18.csv", "utf8"))
const UA = "Mozilla/5.0 (compatible; SportsHubOne-CensusCheck/1.0)"

async function fetchPage(url) {
  if (!url) return { status: "no-url" }
  let u = /^https?:\/\//i.test(url) ? url : "https://" + url
  if (/instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|linktr\.ee/i.test(u)) return { status: "social" }
  for (const attempt of [u, u.replace(/^https:/, "http:")]) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 9000)
      const res = await fetch(attempt, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA } })
      clearTimeout(t)
      if (!res.ok) return { status: `http-${res.status}` }
      return { status: "live", body: (await res.text()).slice(0, 400000) }
    } catch { /* http fallback */ }
  }
  return { status: "unreachable" }
}

// Contact pages often hold the goods; probe the homepage AND /contact.
const out = []
let done = 0
const queue = [...rows]
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const r = queue.shift()
    const site = r.website
    let page = await fetchPage(site)
    let where = "home"
    const find = (p) => {
      if (p.status !== "live") return null
      const body = p.body.toLowerCase()
      if (r.kind === "email") return body.includes(r.value.toLowerCase())
      const digits = r.value.replace(/\D/g, "")
      return digits.length >= 10 ? p.body.replace(/\D/g, "").includes(digits) : null
    }
    let hit = find(page)
    if (page.status === "live" && !hit) {
      const base = /^https?:\/\//i.test(site) ? site : "https://" + site
      const contact = await fetchPage(base.replace(/\/$/, "") + "/contact")
      const h2 = find(contact)
      if (h2) { hit = true; where = "/contact" }
    }
    out.push([r.club, r.kind, r.value, site, page.status, hit === true ? `confirmed (${where})` : page.status === "live" ? "NOT FOUND ON SITE" : page.status === "social" ? "social source, unprobeable" : "SITE UNREACHABLE"])
    if (++done % 20 === 0) console.log(`  ${done}/${rows.length}`)
  }
}))

writeFileSync(ROOT + "docs/research/validation/verified-contacts-recheck.csv",
  "club,kind,value,site,site_status,verdict\n" + out.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n")
const tally = {}
for (const r of out) tally[r[5].split(" (")[0]] = (tally[r[5].split(" (")[0]] || 0) + 1
console.log(JSON.stringify(tally, null, 2))
