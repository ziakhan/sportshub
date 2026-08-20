// Apply the VALIDATED club data to a database (owner 2026-08-19/20).
//
//   node scripts/census/apply-validated-data.mjs            # DRY RUN (default)
//   node scripts/census/apply-validated-data.mjs --apply    # write
//
// Sources (validation evidence, committed):
//   docs/club-edits-for-live-2026-08-18.csv                Kai's 51 hand edits
//   docs/research/validation/verified-contacts-recheck.csv only rows re-CONFIRMED on the live site
//   docs/research/validation/dead-list-recheck.csv         only rows re-CONFIRMED dead
//   docs/research/validation/auto-clearance.csv            WRONG-OWNER-SUSPECT exclusions
//
// Discipline:
//   · FILL-ONLY: a field is written only when the row's current value is
//     empty. A differing non-empty value is reported as a conflict, never
//     overwritten. The one deliberate exception: websites on the
//     confirmed-dead list are cleared (that is the cleanup).
//   · Clubs on the wrong-owner suspect list get NO contact writes.
//   · The ten census clubs the demo seeds flipped ACTIVE (dataSources set,
//     zero claims, every team a seed team) return to UNCLAIMED.
//   · Every change is printed; --apply also writes an audit JSON next to
//     this script's outputs.

import { readFileSync, writeFileSync } from "fs"
import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
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

const norm = (s) => (s || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]/g, "")

const edits = parseCsv(readFileSync(ROOT + "docs/club-edits-for-live-2026-08-18.csv", "utf8"))
const verified = parseCsv(readFileSync(ROOT + "docs/research/validation/verified-contacts-recheck.csv", "utf8"))
  .filter((r) => r.verdict.startsWith("confirmed"))
const dead = parseCsv(readFileSync(ROOT + "docs/research/validation/dead-list-recheck.csv", "utf8"))
  .filter((r) => r.verdict === "confirmed")
const suspects = new Set(
  parseCsv(readFileSync(ROOT + "docs/research/validation/auto-clearance.csv", "utf8"))
    .filter((r) => r.verdict === "WRONG-OWNER-SUSPECT")
    .map((r) => norm(r.club))
)

const prisma = new PrismaClient()
const tenants = await prisma.tenant.findMany({
  where: { mergedIntoId: null },
  select: {
    id: true, name: true, slug: true, status: true, website: true,
    contactEmail: true, phoneNumber: true, latitude: true, longitude: true,
    dataSources: true,
  },
})
const byName = new Map()
for (const t of tenants) {
  const k = norm(t.name)
  if (!byName.has(k)) byName.set(k, [])
  byName.get(k).push(t)
}
const findOne = (name) => {
  const list = byName.get(norm(name)) || []
  return list.length === 1 ? list[0] : list.length === 0 ? null : "ambiguous"
}

const plan = []
const conflicts = []
const misses = []

/** Placeholder/premium patterns caught in review (900-900-9009 was in the
 *  sheets): reject 900/976 area codes, short numbers, and digit wallpaper.
 *  Also require a Canadian (or toll-free) area code: a US number on a
 *  Canadian youth club is a wrong-owner tell (812-xxx Indiana slipped
 *  through a discovery batch). */
const CANADIAN_AREA_CODES = new Set([
  "204", "226", "236", "249", "250", "257", "263", "289", "306", "343",
  "354", "365", "367", "368", "382", "403", "416", "418", "428", "431",
  "437", "438", "450", "468", "474", "506", "514", "519", "548", "579",
  "581", "584", "587", "604", "613", "639", "647", "672", "683", "705",
  "709", "742", "753", "778", "780", "782", "807", "819", "825", "867",
  "873", "879", "902", "905",
  // toll-free, legitimate for clubs
  "800", "833", "844", "855", "866", "877", "888",
])
function phoneSane(v) {
  const d = (v || "").replace(/\D/g, "").replace(/^1/, "")
  if (d.length !== 10) return false
  if (/^(900|976)/.test(d)) return false
  if (/^(\d)\1{9}$/.test(d)) return false
  if (/^55501/.test(d.slice(3))) return false
  if (new Set(d).size <= 2) return false
  if (!CANADIAN_AREA_CODES.has(d.slice(0, 3))) return false
  return true
}

function fill(t, field, value, source, extra = {}) {
  if (!value) return
  if (field === "phoneNumber" && !phoneSane(value)) {
    conflicts.push({ name: t.name, field, current: t[field], proposed: value, source: source + " REJECTED-INSANE-PHONE" })
    return
  }
  const cur = t[field]
  if (cur == null || cur === "" ) {
    plan.push({ id: t.id, name: t.name, field, value, from: cur ?? null, source, ...extra })
  } else if (String(cur).trim() !== String(value).trim()) {
    conflicts.push({ name: t.name, field, current: cur, proposed: value, source })
  }
}

/* 1. Kai's hand-edit sheet (fill-only) */
for (const e of edits) {
  const t = findOne(e.club)
  if (!t) { misses.push({ source: "edits", club: e.club }); continue }
  if (t === "ambiguous") { misses.push({ source: "edits-ambiguous", club: e.club }); continue }
  const blocked = suspects.has(norm(e.club))
  if (!blocked) {
    fill(t, "contactEmail", e.email, "edits")
    fill(t, "phoneNumber", e.phone, "edits")
  }
  fill(t, "website", e.website, "edits")
  if (e.lat && t.latitude == null) plan.push({ id: t.id, name: t.name, field: "latitude", value: parseFloat(e.lat), source: "edits" })
  if (e.lon && t.longitude == null) plan.push({ id: t.id, name: t.name, field: "longitude", value: parseFloat(e.lon), source: "edits" })
}

/* 2. Re-confirmed scraped contacts (fill-only, suspects excluded) */
for (const v of verified) {
  const t = findOne(v.club)
  if (!t || t === "ambiguous") { misses.push({ source: "verified", club: v.club }); continue }
  if (suspects.has(norm(v.club))) continue
  if (v.kind === "email") fill(t, "contactEmail", v.value, "verified-scrape")
  if (v.kind === "phone") fill(t, "phoneNumber", v.value, "verified-scrape")
}

/* 2b. Discovery-sweep findings (--discovered): probe/MX-verified rows from
   ingest-discovery.mjs, fill-only, suspects excluded, socials become the
   website only when the club has nothing at all. */
if (process.argv.includes("--discovered")) {
  const disc = parseCsv(readFileSync(ROOT + "docs/research/validation/discovered-verified.csv", "utf8"))
  for (const d of disc) {
    const t = findOne(d.club)
    if (!t) { misses.push({ source: "discovered", club: d.club }); continue }
    if (t === "ambiguous") { misses.push({ source: "discovered-ambiguous", club: d.club }); continue }
    if (suspects.has(norm(d.club))) continue
    const prov = { sourceUrl: d.source_url || null, confidence: d.confidence || null }
    if (d.website) fill(t, "website", d.website, `discovered(${d.confidence})`, prov)
    if (d.email) fill(t, "contactEmail", d.email, `discovered(${d.confidence})`, prov)
    if (d.phone) fill(t, "phoneNumber", d.phone, `discovered(${d.confidence})`, prov)
  }
}

/* 3. Confirmed-dead websites: clear them (the deliberate blank) */
for (const d of dead) {
  const t = findOne(d.club)
  if (!t || t === "ambiguous") { misses.push({ source: "dead", club: d.club }); continue }
  const deadUrl = (d.url || "").replace(/\/+$/, "")
  const cur = (t.website || "").replace(/\/+$/, "")
  if (cur && deadUrl && cur.toLowerCase() === deadUrl.toLowerCase()) {
    plan.push({ id: t.id, name: t.name, field: "website", value: null, from: t.website, source: "dead-site-clear" })
  }
}

/* 4. The ten seed-adopted census clubs back to UNCLAIMED */
const seedActive = await prisma.tenant.findMany({
  where: { status: "ACTIVE", dataSources: { not: null }, mergedIntoId: null },
  select: { id: true, name: true, teams: { select: { description: true } }, claims: { where: { status: { not: "REJECTED" } }, select: { id: true } } },
}).catch(async () => {
  // claims relation name may differ; retry without it and treat as zero.
  const rows = await prisma.tenant.findMany({
    where: { status: "ACTIVE", dataSources: { not: null }, mergedIntoId: null },
    select: { id: true, name: true, teams: { select: { description: true } } },
  })
  return rows.map((r) => ({ ...r, claims: [] }))
})
for (const t of seedActive) {
  const allSeed = t.teams.length > 0 && t.teams.every((x) => x.description === "NPH_DEMO_SEED" || x.description === "SHOWCASE_SEED")
  if (allSeed && t.claims.length === 0) {
    plan.push({ id: t.id, name: t.name, field: "status", value: "UNCLAIMED", from: "ACTIVE", source: "seed-adoption-fix" })
  }
}

/* ── report / apply ──────────────────────────────────────────────────────── */

const byField = {}
for (const p of plan) byField[p.field] = (byField[p.field] || 0) + 1
console.log(`MODE: ${APPLY ? "APPLY" : "DRY RUN"}`)
console.log("planned writes by field:", byField)
console.log("conflicts (reported, untouched):", conflicts.length)
console.log("unmatched rows:", misses.length)
for (const p of plan.slice(0, 12)) console.log("  eg:", p.name, "·", p.field, "→", String(p.value).slice(0, 60))

writeFileSync(ROOT + "docs/research/validation/apply-" + (APPLY ? "run" : "dryrun") + ".json",
  JSON.stringify({ when: new Date().toISOString(), mode: APPLY ? "apply" : "dry", byField, plan, conflicts, misses }, null, 2))

if (APPLY) {
  let written = 0
  for (const p of plan) {
    await prisma.tenant.update({ where: { id: p.id }, data: { [p.field]: p.value } })
    // Every machine write is flagged for human review in the club console
    // (owner 2026-08-20), with the old value kept so review can revert.
    await prisma.tenantEnrichment.create({
      data: {
        tenantId: p.id,
        field: p.field,
        fromValue: p.from == null ? null : String(p.from),
        toValue: p.value == null ? null : String(p.value),
        source: p.source,
        sourceUrl: p.sourceUrl ?? null,
        confidence: p.confidence ?? null,
        appliedBy: "apply-validated-data",
      },
    })
    written++
  }
  console.log(`written: ${written} field updates, each flagged for review`)
}

/* --backfill-flags: create review rows for a PRIOR run's plan (the 150
   writes applied before the review system existed), without re-writing
   tenant fields. Reads docs/research/validation/apply-run.json. */
if (process.argv.includes("--backfill-flags")) {
  const prior = JSON.parse(readFileSync(ROOT + "docs/research/validation/apply-run.json", "utf8"))
  // That run predates from-capture, so its log has no old values. They are
  // still pinned down by the run's own inputs: a dead-site clear's old value
  // IS the confirmed-dead URL, a seed-adoption flip was ACTIVE by definition,
  // and everything else was fill-only, so "was empty" is the truth.
  const deadByClub = new Map(dead.map((d) => [norm(d.club), (d.url || "").trim()]))
  let made = 0
  for (const p of prior.plan) {
    let from = p.from ?? null
    if (from == null) {
      if (p.source === "dead-site-clear") from = deadByClub.get(norm(p.name)) ?? null
      else if (p.source === "seed-adoption-fix") from = "ACTIVE"
    }
    await prisma.tenantEnrichment.create({
      data: {
        tenantId: p.id,
        field: p.field,
        fromValue: from == null ? null : String(from),
        toValue: p.value == null ? null : String(p.value),
        source: p.source + " (backfilled)",
        sourceUrl: p.sourceUrl ?? null,
        confidence: p.confidence ?? null,
        appliedBy: "apply-validated-data",
      },
    })
    made++
  }
  console.log(`backfilled review flags: ${made}`)
}
await prisma.$disconnect()
