/**
 * Is every North Pole Hoops club in the database?
 *
 *   node scripts/research/check-nph-coverage.mjs
 *
 * Reads the 2025-26 NPH team-entry census (docs/research/census-nph-2025-26.md)
 * and looks each club up. Matching is reported at three strengths so a loose
 * hit can be eyeballed rather than counted as coverage on trust.
 */
import fs from "fs"
import { PrismaClient } from "@prisma/client"

const SRC = "docs/research/census-nph-2025-26.md"
const prisma = new PrismaClient()

const strip = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Full normalisation: every word kept, punctuation dropped. */
const norm = (s) => strip(s).replace(/[^a-z0-9]+/g, " ").trim()

/** The name without any bracketed aside, which is usually a division note. */
const stem = (s) => norm(s.replace(/\([^)]*\)/g, " "))

const NOISE = new Set([
  "basketball", "club", "association", "academy", "elite", "prep", "sports",
  "sport", "the", "of", "and", "inc", "school", "college", "program", "programs",
  "athletics", "bball", "hoops", "youth", "minor",
])
const words = (s) => new Set(stem(s).split(" ").filter((w) => w.length > 2 && !NOISE.has(w)))

const text = fs.readFileSync(SRC, "utf8")

// Multi-entry clubs live in a markdown table; the first cell is the club.
const multi = []
for (const line of text.split("\n")) {
  const m = /^\|\s*([^|]+?)\s*\|\s*(SL|D1|NPA|WNPA)/.exec(line)
  if (m) multi.push(m[1].trim())
}

// Single-entry clubs are one prose block of "Name (division) · Name (division)".
const block = text.split("## Single-entry clubs")[1]?.split("\\*")[0] ?? ""
const single = block
  .split("·")
  .map((s) => s.replace(/\n/g, " ").trim())
  .map((s) => s.replace(/\([^)]*\)\s*$/, "").trim())
  .filter((s) => s && !s.startsWith("#") && s.length > 2)

const clubs = [...new Set([...multi, ...single])]

// The demo world seeds ~81 clubs FROM this very census, with nph* slugs, and
// neither isDemo nor isTestWorldSlug catches them. Counting those as coverage
// would report a perfect score for clubs we never actually researched.
const DEMO_SLUG = /^(nph|w[a-z0-9]*[0-9][a-z0-9]*-)/

const live = (await prisma.tenant.findMany({
  where: { mergedIntoId: null },
  select: {
    id: true,
    name: true,
    city: true,
    status: true,
    publishedAt: true,
    searchAliases: true,
    contactEmail: true,
    phoneNumber: true,
    website: true,
    slug: true,
    isDemo: true,
  },
})).filter((t) => !t.isDemo && !DEMO_SLUG.test(t.slug))

// Every name a club answers to, normalised.
const index = live.map((t) => ({
  t,
  keys: new Set(
    [t.name, ...(t.searchAliases || "").split("|")]
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((s) => [norm(s), stem(s)])
  ),
  words: words(t.name),
}))

function find(name) {
  const n = norm(name)
  const st = stem(name)
  const w = words(name)

  // Gather every candidate, then take the best. Taking the first match instead
  // paired "Tri-City (Prep/Academy)" with a Halifax club while the Kitchener
  // "Tri-City Prep" sat further down the list.
  const cands = []
  for (const e of index) {
    if (e.keys.has(n) || e.keys.has(st)) {
      cands.push({ e, how: "exact", gap: 0 })
      continue
    }
    const near = [...e.keys].find(
      (k) => k && (k.startsWith(st + " ") || st.startsWith(k + " "))
    )
    if (near) {
      cands.push({ e, how: "contained", gap: Math.abs(near.length - st.length) })
      continue
    }
    if (w.size && e.words.size && [...w].every((x) => e.words.has(x))) {
      cands.push({ e, how: "loose", gap: Math.abs(norm(e.t.name).length - st.length) })
    }
  }
  if (!cands.length) return null

  const rank = { exact: 0, contained: 1, loose: 2 }
  cands.sort((a, b) => rank[a.how] - rank[b.how] || a.gap - b.gap)
  const best = cands[0]
  return {
    hit: best.e.t,
    how: best.how,
    // More than one plausible club means the answer needs a person, not a score.
    rivals: cands.filter((c) => c.how === best.how).length - 1,
  }
}

const found = []
const missing = []
for (const c of clubs) {
  const r = find(c)
  if (r) found.push({ club: c, ...r })
  else missing.push(c)
}

const reach = (t) => !!(t.contactEmail || t.phoneNumber || t.website)
const byHow = (h) => found.filter((f) => f.how === h).length

console.log(`real (non-demo) clubs searched: ${live.length}`)
console.log(`NPH 2025-26 census: ${clubs.length} distinct clubs`)
console.log(`  in the database        ${found.length}`)
console.log(`    exact name or alias  ${byHow("exact")}`)
console.log(`    one name inside another ${byHow("contained")}`)
console.log(`    same distinctive words  ${byHow("loose")}`)
console.log(`  NOT found              ${missing.length}`)
console.log("")
console.log(`  of those found, published  ${found.filter((f) => f.hit.publishedAt).length}`)
console.log(`  of those found, reachable  ${found.filter((f) => reach(f.hit)).length}`)

if (missing.length) {
  console.log("\nMISSING:")
  for (const m of missing) console.log(`   ${m}`)
}

const loose = found.filter((f) => f.how !== "exact")
if (loose.length) {
  console.log("\nMATCHED LOOSELY (worth an eyeball):")
  for (const f of loose) {
    const amb = f.rivals ? `  (+${f.rivals} other candidate${f.rivals === 1 ? "" : "s"})` : ""
    console.log(`   ${f.club.slice(0, 32).padEnd(32)} -> ${f.hit.name.slice(0, 38).padEnd(38)} [${f.how}]${amb}`)
  }
}

// Reachable and published are independent: a club can be on the public site
// with no contact details, or fully contactable but held back as a draft.
const grid = { both: [], contactOnly: [], publishedOnly: [], neither: [] }
for (const f of found) {
  const r = reach(f.hit)
  const pub = !!f.hit.publishedAt
  if (r && pub) grid.both.push(f)
  else if (r) grid.contactOnly.push(f)
  else if (pub) grid.publishedOnly.push(f)
  else grid.neither.push(f)
}
console.log("\n                      published   draft")
console.log(`  have a contact        ${String(grid.both.length).padStart(6)}   ${String(grid.contactOnly.length).padStart(6)}`)
console.log(`  no contact at all     ${String(grid.publishedOnly.length).padStart(6)}   ${String(grid.neither.length).padStart(6)}`)

console.log(`\nLIVE ON THE SITE BUT NOBODY CAN BE CONTACTED (${grid.publishedOnly.length}):`)
for (const f of grid.publishedOnly) console.log(`   ${f.hit.name.slice(0, 46)}`)

console.log(`\nCONTACTABLE BUT STILL A DRAFT - one click from public (${grid.contactOnly.length}):`)
for (const f of grid.contactOnly) {
  const how = [f.hit.contactEmail && "email", f.hit.phoneNumber && "phone", f.hit.website && "web"]
    .filter(Boolean)
    .join("/")
  console.log(`   ${f.hit.name.slice(0, 40).padEnd(40)} ${how}`)
}

console.log(`\nNEITHER - a name and nothing else (${grid.neither.length}):`)
for (const f of grid.neither) console.log(`   ${f.hit.name.slice(0, 46)}`)

await prisma.$disconnect()
