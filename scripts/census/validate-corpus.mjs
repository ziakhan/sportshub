// Corpus validation sweep (owner 2026-08-19): independently re-verify every
// claim in the staged club data BEFORE any of it is applied to the box, and
// recompute how many clubs can be auto-cleared with zero human intervention.
//
//   node scripts/census/validate-corpus.mjs
//
// Inputs (all committed):
//   docs/research/consolidated/clubs-consolidated.csv   the 1,516-club corpus
//   docs/club-websites-dead-2026-08-18.csv              Kai's dead-site list
//   docs/club-contacts-verified-2026-08-18.csv          Kai's verified contacts
//   docs/club-edits-for-live-2026-08-18.csv             Kai's ready-to-enter edits
//
// Outputs (evidence, committed):
//   docs/research/validation/website-liveness.csv       every corpus website probed
//   docs/research/validation/email-mx.csv               every email domain MX-checked
//   docs/research/validation/dead-list-recheck.csv      Kai's 96, re-probed
//   docs/research/validation/verified-contacts-recheck.csv  his 76, source re-fetched
//   docs/research/validation/auto-clearance.csv         per-club readiness verdicts
//   docs/research/validation/summary.json               the numbers
//
// Read-only against the world; writes only under docs/research/validation/.

import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolveMx } from "dns/promises"

const ROOT = new URL("../..", import.meta.url).pathname
const OUT = ROOT + "docs/research/validation/"
mkdirSync(OUT, { recursive: true })

/* ── tiny CSV io (quoted-field aware) ─────────────────────────────────────── */

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
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])))
}

const csvEscape = (v) => {
  const s = String(v ?? "")
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const writeCsv = (path, header, rows) =>
  writeFileSync(path, header.join(",") + "\n" + rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n")

/* ── inputs ───────────────────────────────────────────────────────────────── */

const corpus = parseCsv(readFileSync(ROOT + "docs/research/consolidated/clubs-consolidated.csv", "utf8"))
const deadList = parseCsv(readFileSync(ROOT + "docs/club-websites-dead-2026-08-18.csv", "utf8"))
const verified = parseCsv(readFileSync(ROOT + "docs/club-contacts-verified-2026-08-18.csv", "utf8"))
const edits = parseCsv(readFileSync(ROOT + "docs/club-edits-for-live-2026-08-18.csv", "utf8"))

console.log(`corpus=${corpus.length} dead-list=${deadList.length} verified=${verified.length} edits=${edits.length}`)

/* ── probe machinery ─────────────────────────────────────────────────────── */

const UA = "Mozilla/5.0 (compatible; SportsHubOne-CensusCheck/1.0)"

async function probe(url) {
  if (!url) return { status: "no-url" }
  let u = url.trim()
  if (!/^https?:\/\//i.test(u)) u = "https://" + u
  // Social links are profiles, not sites; mark and skip the fetch (they
  // bot-wall probes and always "fail" regardless of liveness).
  if (/instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|linktr\.ee/i.test(u)) {
    return { status: "social", final: u }
  }
  for (const attempt of [u, u.replace(/^https:/, "http:")]) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 9000)
      const res = await fetch(attempt, {
        method: "GET",
        redirect: "follow",
        signal: ctl.signal,
        headers: { "user-agent": UA, accept: "text/html,*/*" },
      })
      clearTimeout(t)
      const body = res.ok ? (await res.text()).slice(0, 250000) : ""
      // Parked/for-sale pages read as live to a status check; catch the tells.
      const parked = /domain (is )?for sale|buy this domain|parked free|godaddy\.com\/park|sedoparking|this domain has expired/i.test(body)
      return {
        status: res.ok ? (parked ? "parked" : "live") : `http-${res.status}`,
        final: res.url,
        body,
      }
    } catch {
      /* try http fallback, then fall through */
    }
  }
  return { status: "unreachable" }
}

async function pool(items, worker, size = 16) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await worker(items[i], i)
        if (next % 100 === 0) console.log(`  ...${next}/${items.length}`)
      }
    })
  )
  return results
}

/* ── V1a: every corpus website ────────────────────────────────────────────── */

console.log("V1a: probing every corpus website...")
const withSites = corpus.filter((c) => c.website)
const liveness = await pool(withSites, async (c) => {
  const p = await probe(c.website)
  return { name: c.club_name, url: c.website, status: p.status, final: p.final ?? "" }
})
writeCsv(OUT + "website-liveness.csv", ["club", "url", "status", "final_url"], liveness.map((r) => [r.name, r.url, r.status, r.final]))
const liveCount = liveness.filter((r) => r.status === "live").length
const parkedCount = liveness.filter((r) => r.status === "parked").length
const socialCount = liveness.filter((r) => r.status === "social").length
const deadNow = liveness.filter((r) => r.status === "unreachable" || /^http-4|^http-5/.test(r.status))

/* ── V1b: MX check every email domain ─────────────────────────────────────── */

console.log("V1b: MX-checking email domains...")
const emails = corpus.filter((c) => c.email && c.email.includes("@"))
const domains = [...new Set(emails.map((c) => c.email.split("@")[1].toLowerCase()))]
const mxByDomain = new Map()
await pool(domains, async (d) => {
  try {
    const mx = await resolveMx(d)
    mxByDomain.set(d, mx.length > 0 ? "mx-ok" : "no-mx")
  } catch {
    mxByDomain.set(d, "no-mx")
  }
}, 24)
writeCsv(OUT + "email-mx.csv", ["domain", "status", "emails_on_domain"],
  domains.map((d) => [d, mxByDomain.get(d), emails.filter((c) => c.email.toLowerCase().endsWith("@" + d)).length]))
const deliverable = emails.filter((c) => mxByDomain.get(c.email.split("@")[1].toLowerCase()) === "mx-ok").length

/* ── V2: re-probe Kai's dead list ─────────────────────────────────────────── */

console.log("V2: re-probing the dead list...")
const deadUrlKey = Object.keys(deadList[0]).find((k) => /url|website|site/i.test(k))
const deadRecheck = await pool(deadList, async (r) => {
  const p = await probe(r[deadUrlKey])
  return [r[Object.keys(r)[0]], r[deadUrlKey], p.status, p.status === "live" ? "DISPUTED: resolves now" : "confirmed"]
})
writeCsv(OUT + "dead-list-recheck.csv", ["club", "url", "status_now", "verdict"], deadRecheck)
const deadConfirmed = deadRecheck.filter((r) => r[3] === "confirmed").length

/* ── V3: re-fetch the 76 verified contacts' source pages ─────────────────── */

console.log("V3: re-fetching verified contacts' sources...")
const vKeys = Object.keys(verified[0])
const vSource = vKeys.find((k) => /source|url|page/i.test(k))
const vEmail = vKeys.find((k) => /email/i.test(k))
const vPhone = vKeys.find((k) => /phone/i.test(k))
const verifiedRecheck = await pool(verified, async (r) => {
  const p = await probe(r[vSource])
  if (p.status !== "live") return [r[vKeys[0]], r[vSource], p.status, "SOURCE GONE"]
  const body = (p.body || "").toLowerCase()
  const emailOk = r[vEmail] ? body.includes(r[vEmail].toLowerCase()) : null
  const digits = (r[vPhone] || "").replace(/\D/g, "")
  const phoneOk = digits.length >= 10 ? body.replace(/\D/g, "").includes(digits) : null
  const verdict = emailOk || phoneOk ? "confirmed" : emailOk === false && phoneOk === false ? "NOT ON PAGE" : "page live, contact unverifiable"
  return [r[vKeys[0]], r[vSource], p.status, verdict]
})
writeCsv(OUT + "verified-contacts-recheck.csv", ["club", "source", "source_status", "verdict"], verifiedRecheck)

/* ── V4+V5: wrong-owner heuristic + auto-clearance across the corpus ─────── */

console.log("V4/V5: auto-clearance verdicts...")
const STOP = new Set(["basketball", "bball", "club", "academy", "elite", "sports", "sport", "the", "and", "of", "athletics", "assoc", "association", "minor", "youth"])
const tokens = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t))
const domainOf = (u) => { try { return new URL(/^https?:/i.test(u) ? u : "https://" + u).hostname.replace(/^www\./, "") } catch { return "" } }
const FREE = /gmail|hotmail|yahoo|outlook|icloud|live\.|aol\./i

const livenessByUrl = new Map(liveness.map((r) => [r.url, r.status]))
const clearance = corpus.map((c) => {
  const site = c.website || ""
  const siteStatus = site ? livenessByUrl.get(site) ?? "unprobed" : "no-site"
  const sDom = domainOf(site)
  const eDom = c.email && c.email.includes("@") ? c.email.split("@")[1].toLowerCase() : ""
  const mx = eDom ? mxByDomain.get(eDom) ?? "unknown" : "no-email"
  const nameToks = tokens(c.club_name)
  const domToks = (sDom.split(".")[0] || "").toLowerCase()
  const nameMatchesSite = nameToks.some((t) => domToks.includes(t.slice(0, Math.min(t.length, 6))))
  const emailMatchesSite = !!eDom && !!sDom && (eDom === sDom || eDom.endsWith("." + sDom))
  const freeEmail = FREE.test(eDom)
  // Wrong-owner suspicion: an org-domain email whose domain matches NEITHER
  // the club's site nor any name token — likely harvested off someone else.
  const eDomBase = (eDom.split(".")[0] || "")
  const wrongOwner = !!eDom && !freeEmail && !emailMatchesSite && !nameToks.some((t) => eDomBase.includes(t.slice(0, Math.min(t.length, 6))))
  const autoReady =
    siteStatus === "live" && mx === "mx-ok" && emailMatchesSite && nameMatchesSite
  const verdict = autoReady
    ? "AUTO-READY"
    : wrongOwner
      ? "WRONG-OWNER-SUSPECT"
      : siteStatus === "live" && mx === "mx-ok"
        ? "ready-with-review"
        : "needs-work"
  return [c.club_name, c.province, siteStatus, mx, freeEmail ? "free" : eDom || "-", emailMatchesSite ? "y" : "n", nameMatchesSite ? "y" : "n", verdict]
})
writeCsv(OUT + "auto-clearance.csv",
  ["club", "province", "site_status", "email_mx", "email_domain", "email_matches_site", "name_matches_site", "verdict"], clearance)

const counts = {}
for (const r of clearance) counts[r[7]] = (counts[r[7]] || 0) + 1

const summary = {
  generated: new Date().toISOString().slice(0, 10),
  corpus: corpus.length,
  websites: { probed: withSites.length, live: liveCount, parked: parkedCount, social: socialCount, dead_now: deadNow.length },
  emails: { total: emails.length, unique_domains: domains.length, mx_deliverable: deliverable },
  kai_dead_list: { claimed: deadList.length, confirmed_dead: deadConfirmed, disputed: deadList.length - deadConfirmed },
  kai_verified_contacts: {
    claimed: verified.length,
    confirmed: verifiedRecheck.filter((r) => r[3] === "confirmed").length,
    source_gone: verifiedRecheck.filter((r) => r[3] === "SOURCE GONE").length,
    not_on_page: verifiedRecheck.filter((r) => r[3] === "NOT ON PAGE").length,
    unverifiable: verifiedRecheck.filter((r) => r[3] === "page live, contact unverifiable").length,
  },
  edits_sheet_rows: edits.length,
  clearance: counts,
}
writeFileSync(OUT + "summary.json", JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
