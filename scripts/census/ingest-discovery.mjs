// Ingest the discovery sweep (owner 2026-08-19/20): merge every results CSV
// from the pilot and waves, then INDEPENDENTLY verify each found value before
// it is allowed anywhere near the database:
//   · found_website  -> live HTTP probe (parked-page detection included)
//   · found_email    -> MX check on the domain
//   · found_phone    -> the same sanity filter the apply tool uses
// Only rows that survive land in docs/research/validation/discovered-verified.csv,
// which apply-validated-data.mjs consumes with --discovered (fill-only, as ever).
//
//   node scripts/census/ingest-discovery.mjs <dir-with-result-csvs>

import { readFileSync, writeFileSync, readdirSync } from "fs"
import { resolveMx } from "dns/promises"

const ROOT = new URL("../..", import.meta.url).pathname
const DIR = process.argv[2]
if (!DIR) { console.error("usage: ingest-discovery.mjs <dir>"); process.exit(1) }

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

const NOTVAL = /^(not[- ]?found|n\/?a|none|null|-|)$/i
const clean = (v) => (NOTVAL.test((v || "").trim()) ? "" : v.trim())

function phoneSane(v) {
  const d = (v || "").replace(/\D/g, "").replace(/^1/, "")
  if (d.length !== 10) return false
  if (/^(900|976)/.test(d)) return false
  if (/^(\d)\1{9}$/.test(d)) return false
  if (new Set(d).size <= 2) return false
  return true
}

const UA = "Mozilla/5.0 (compatible; SportsHubOne-CensusCheck/1.0)"
async function probe(url) {
  if (!url) return "no-url"
  let u = /^https?:\/\//i.test(url) ? url : "https://" + url
  if (/instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|linktr\.ee/i.test(u)) return "social"
  for (const attempt of [u, u.replace(/^https:/, "http:")]) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 9000)
      const res = await fetch(attempt, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA, accept: "text/html,*/*" } })
      clearTimeout(t)
      if (!res.ok) return `http-${res.status}`
      const body = (await res.text()).slice(0, 200000)
      if (/domain (is )?for sale|buy this domain|parked free|sedoparking|this domain has expired/i.test(body)) return "parked"
      return "live"
    } catch { /* fall through */ }
  }
  return "unreachable"
}

/* merge every results file */
const files = readdirSync(DIR).filter((f) => f.endsWith(".csv"))
let rows = []
for (const f of files) rows.push(...parseCsv(readFileSync(DIR + "/" + f, "utf8")).map((r) => ({ ...r, _file: f })))
console.log(`merged ${rows.length} rows from ${files.length} files`)

/* candidate rows: any confidence except explicit not-found, with >=1 value */
const candidates = rows
  .map((r) => ({
    club: r.club.replace(/\s*\([^)]*\)\s*$/, ""),
    website: clean(r.found_website),
    email: clean(r.found_email),
    phone: clean(r.found_phone),
    confidence: (r.confidence || "").toLowerCase(),
    source: r.source_url,
    file: r._file,
  }))
  .filter((r) => (r.website || r.email || r.phone) && !r.confidence.startsWith("not"))
console.log(`candidates with at least one value: ${candidates.length}`)

/* verify: probe sites concurrently, MX per unique domain */
const domains = [...new Set(candidates.filter((c) => c.email.includes("@")).map((c) => c.email.split("@")[1].toLowerCase()))]
const mx = new Map()
{
  let i = 0
  await Promise.all(Array.from({ length: 20 }, async () => {
    while (i < domains.length) {
      const d = domains[i++]
      try { mx.set(d, (await resolveMx(d)).length > 0 ? "mx-ok" : "no-mx") } catch { mx.set(d, "no-mx") }
    }
  }))
}
{
  let i = 0
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < candidates.length) {
      const c = candidates[i++]
      c.siteStatus = c.website ? await probe(c.website) : "none"
      if (i % 50 === 0) console.log(`  probed ${i}/${candidates.length}`)
    }
  }))
}

const out = []
const dropped = { site_dead: 0, email_no_mx: 0, phone_insane: 0, nothing_left: 0 }
for (const c of candidates) {
  const site = c.website && (c.siteStatus === "live" || c.siteStatus === "social") ? c.website : ""
  if (c.website && !site) dropped.site_dead++
  const email = c.email.includes("@") && mx.get(c.email.split("@")[1].toLowerCase()) === "mx-ok" ? c.email : ""
  if (c.email && !email) dropped.email_no_mx++
  const phone = phoneSane(c.phone) ? c.phone : ""
  if (c.phone && !phone) dropped.phone_insane++
  if (!site && !email && !phone) { dropped.nothing_left++; continue }
  out.push([c.club, site, c.siteStatus, email, phone, c.confidence, c.source, c.file])
}

writeFileSync(ROOT + "docs/research/validation/discovered-verified.csv",
  "club,website,site_status,email,phone,confidence,source_url,from_file\n" +
  out.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n")

console.log(JSON.stringify({
  merged: rows.length,
  candidates: candidates.length,
  survived: out.length,
  by_confidence: out.reduce((a, r) => ((a[r[5]] = (a[r[5]] || 0) + 1), a), {}),
  dropped,
}, null, 2))
