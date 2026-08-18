/**
 * Reconcile the database with the consolidated census.
 *
 *   npx tsx scripts/merge-census-duplicates.ts --dry-run
 *   npx tsx scripts/merge-census-duplicates.ts
 *
 * The importer only ever creates or updates, so rows created by an earlier,
 * worse consolidation survive as duplicates after the dedupe improves. Markham
 * Unionville ended up as three rows that way, Mississauga Monarchs as five.
 *
 * Each consolidated row carries an `aliases` column listing every name that
 * merged into it. This walks those aliases, finds the leftover database rows,
 * and absorbs them into the survivor using the same transactional merge the
 * admin tool uses — so teams, claims and follows move rather than vanish, and
 * the absorbed row is soft-deleted with a pointer to its survivor.
 *
 * Only ever touches UNCLAIMED, non-demo rows. A claimed or seeded club is left
 * alone and reported: deciding those is a human's call.
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { absorbDuplicateClub, MergeClubsError } from "../apps/web/src/lib/clubs/merge-clubs"

const prisma = new PrismaClient()
const CSV = path.join(
  __dirname,
  "..",
  "docs",
  "research",
  "consolidated",
  "clubs-consolidated.csv"
)

function parseCSV(content: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = "",
    record: string[] = [],
    inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === ",") {
      record.push(field)
      field = ""
    } else if (c === "\n") {
      record.push(field)
      rows.push(record)
      record = []
      field = ""
    } else if (c !== "\r") field += c
  }
  if (field || record.length) {
    record.push(field)
    rows.push(record)
  }
  const header = rows.shift()!.map((h) => h.trim())
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])))
}

/** Same comparison key the consolidation uses, so names match the way it merged them. */
function normName(s: string): string {
  // Undo HTML entities first: "Monarchs - D &amp; Hemeng" and its already-fixed
  // twin "Monarchs - D & Hemeng" are the same row written before and after the
  // scraper learned to decode, and must compare equal.
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
}

/**
 * Whether two city strings can describe the same place.
 *
 * String equality was too strict — "Toronto" and "Toronto ON" blocked merges of
 * clubs with identical names. Treats each field as the SET of places it names,
 * since clubs write "Oshawa/Whitby/Ajax", and requires an overlap.
 */
function citiesCompatible(a: string | null, b: string | null): boolean {
  const places = (v: string | null) =>
    new Set(
      (v ?? "")
        .replace(/\([^)]*\)/g, " ")
        .split(/[/,;&+]| and /i)
        .map((x) => normName(x))
        .filter((x) => x.length >= 3)
    )
  const pa = places(a)
  const pb = places(b)
  if (!pa.size || !pb.size) return true // unknown location is not a disagreement
  for (const x of pa) for (const y of pb) if (x === y || x.includes(y) || y.includes(x)) return true
  return false
}

/**
 * Whether two names share a word that actually identifies an organisation.
 *
 * Town names and basketball words do not count — otherwise every club in
 * Mississauga looks like every other one.
 */
const WEAK_WORDS = new Set([
  "basketball", "club", "association", "academy", "minor", "youth", "the", "of",
  "inc", "sports", "sport", "bball", "program", "programs", "athletics", "and",
  "assoc", "league", "hoops", "group", "elite", "prep", "select", "rep",
  "community", "recreation", "centre", "center", "school", "junior", "senior",
  "boys", "girls", "team", "canada", "ontario", "north", "south", "east", "west",
])

function sharesDistinctiveWord(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !WEAK_WORDS.has(w))
    )
  const wa = words(a)
  for (const w of words(b)) if (wa.has(w)) return true
  return false
}

/** Email, phone and own-domain identity keys for a club. */
function contactKeys(t: {
  contactEmail: string | null
  phoneNumber: string | null
  website: string | null
}): string[] {
  const keys: string[] = []
  const e = (t.contactEmail ?? "").trim().toLowerCase()
  // Seeded demo rows carry example.* addresses; those are not identities.
  if (e.includes("@") && !/example\.(ca|com|org)$/.test(e)) keys.push("e:" + e)
  const d = (t.phoneNumber ?? "").replace(/\D/g, "")
  if (d.length >= 10 && !d.includes("555")) keys.push("p:" + d.slice(-10))
  const host = (t.website ?? "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^www\./, "")
    .toLowerCase()
  const SHARED = /^(facebook|instagram|x|twitter|linktr|youtube|tiktok|wixsite|wix|weebly|squarespace|wordpress|blogspot|google|sites\.google|sportsengine|sportngin|teamlinkt|teamsnap|leagueapps|crossbar|rampinteractive|sportsavvy|powerupsports|uplifterinc|teampages|goalline|tourneymachine|esportsdesk|stacksports|pointstreak)\./
  if (host.includes(".") && !SHARED.test(host)) keys.push("w:" + host)
  return keys
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const rows = parseCSV(fs.readFileSync(CSV, "utf-8"))

  // Every UNCLAIMED census row still standing, indexed by normalised name.
  const live = await prisma.tenant.findMany({
    where: { status: "UNCLAIMED", isDemo: false, mergedIntoId: null },
    select: { id: true, name: true, city: true, state: true, contactEmail: true },
  })
  const byName = new Map<string, typeof live>()
  for (const t of live) {
    const k = normName(t.name)
    if (!byName.has(k)) byName.set(k, [])
    byName.get(k)!.push(t)
  }

  let merged = 0
  let skippedClaimed = 0
  let noSurvivor = 0
  const failures: string[] = []
  const crossCity: string[] = []

  for (const r of rows) {
    const aliases = (r.aliases || "")
      .split("|")
      .map((a) => a.trim())
      .filter(Boolean)
    if (aliases.length < 2) continue // nothing merged into this row

    // The survivor: the database row matching the consolidated club's own name.
    const survivors = byName.get(normName(r.club_name)) ?? []
    if (!survivors.length) {
      noSurvivor++
      continue
    }
    const survivor = survivors[0]

    for (const alias of aliases) {
      const key = normName(alias)
      if (key === normName(r.club_name)) continue
      for (const dup of byName.get(key) ?? []) {
        if (dup.id === survivor.id) continue
        // Aliases come from the clustering and are normally trustworthy, but a
        // single bad one merges two unrelated clubs and moves one's contact
        // details onto the other's name - which is how a Windsor team ended up
        // holding a Mississauga club's email. Towns must still agree.
        if (!citiesCompatible(dup.city, survivor.city)) {
          crossCity.push(`${survivor.name} <- ${dup.name}`)
          continue
        }
        if (dryRun) {
          console.log(`  ${survivor.name.slice(0, 40)}  <-  ${dup.name.slice(0, 40)}`)
          merged++
          continue
        }
        try {
          await prisma.$transaction((tx) =>
            absorbDuplicateClub(tx, { sourceId: dup.id, targetId: survivor.id })
          )
          merged++
        } catch (e) {
          if (e instanceof MergeClubsError) {
            if (e.code === "BOTH_CLAIMED") skippedClaimed++
            else failures.push(`${dup.name}: ${e.code}`)
          } else throw e
        }
      }
    }
  }

  // Rows an earlier import created that the alias walk cannot reach — e.g. a
  // name that no longer appears in the census at all. Any two UNCLAIMED rows
  // with the same normalised name in the same town are the same club.
  let exactDupes = 0
  for (const [key, group] of byName) {
    if (group.length < 2 || !key) continue
    const [keep, ...rest] = group
    for (const dup of rest) {
      if (!citiesCompatible(dup.city, keep.city)) continue
      if (dryRun) {
        console.log(`  [exact] ${keep.name.slice(0, 38)}  <-  ${dup.name.slice(0, 38)}`)
        exactDupes++
        continue
      }
      try {
        await prisma.$transaction((tx) =>
          absorbDuplicateClub(tx, { sourceId: dup.id, targetId: keep.id })
        )
        exactDupes++
      } catch (e) {
        if (!(e instanceof MergeClubsError)) throw e
      }
    }
  }
  console.log(`exact-name duplicates ${dryRun ? "found" : "merged"}: ${exactDupes}`)

  // ---- contact-identity pass -------------------------------------------------
  // Two rows sharing an email, phone or web domain are one organisation, even
  // when the names look unrelated: "Mississauga Monarchs" and "Mississauga
  // Minor Basketball Association" both point at monarchsbasketball.ca. Branches
  // in DIFFERENT towns are left alone — nine IEM branches share one inbox.
  const fresh = await prisma.tenant.findMany({
    where: { isDemo: false, mergedIntoId: null },
    select: {
      id: true, name: true, city: true, status: true, contactEmail: true,
      phoneNumber: true, website: true, dataSources: true, publishedAt: true, latitude: true,
    },
  })
  const keyed = new Map<string, typeof fresh>()
  for (const t of fresh) {
    for (const k of contactKeys(t)) {
      if (!keyed.has(k)) keyed.set(k, [])
      keyed.get(k)!.push(t)
    }
  }
  let byContact = 0
  const seen = new Set<string>()
  for (const [, group] of keyed) {
    if (group.length < 2) continue
    // Richest record survives: most sources, then most contact fields filled.
    const ranked = [...group].sort(
      (a, b) =>
        (b.dataSources ?? "").split(",").length - (a.dataSources ?? "").split(",").length ||
        [b.contactEmail, b.phoneNumber, b.website].filter(Boolean).length -
          [a.contactEmail, a.phoneNumber, a.website].filter(Boolean).length
    )
    const keep = ranked[0]
    for (const dup of ranked.slice(1)) {
      const pair = [keep.id, dup.id].sort().join("|")
      if (seen.has(pair)) continue
      seen.add(pair)
      if (!citiesCompatible(dup.city, keep.city)) continue
      if (keep.status === "ACTIVE" && dup.status === "ACTIVE") continue
      // A shared WEB DOMAIN is near-proof of identity: a club owns its domain.
      // A shared inbox or phone is weaker — one person often administers two
      // genuinely different clubs (V3 Basketball and Scarborough Prep share an
      // address but are separate brands), so those also need the names to share
      // a distinctive word.
      const sharedKeys = contactKeys(keep).filter((k) => contactKeys(dup).includes(k))
      const byDomain = sharedKeys.some((k) => k.startsWith("w:"))
      if (!byDomain && !sharesDistinctiveWord(keep.name, dup.name)) continue
      if (dryRun) {
        console.log(`  [contact] ${keep.name.slice(0, 36)}  <-  ${dup.name.slice(0, 36)}`)
        byContact++
        continue
      }
      try {
        await prisma.$transaction((tx) =>
          absorbDuplicateClub(tx, { sourceId: dup.id, targetId: keep.id })
        )
        byContact++
      } catch (e) {
        if (!(e instanceof MergeClubsError)) throw e
      }
    }
  }
  console.log(`shared-contact duplicates ${dryRun ? "found" : "merged"}: ${byContact}`)

  // ---- orphans ---------------------------------------------------------------
  // Census rows the consolidation no longer produces — usually a team entry that
  // a later pass correctly reclassified. They are unpublished rather than
  // deleted: a human should confirm before anything disappears for good.
  const census = new Set<string>()
  for (const r of rows) {
    census.add(normName(r.club_name))
    for (const a of (r.aliases || "").split("|")) if (a.trim()) census.add(normName(a))
  }
  const orphans = fresh.filter(
    (t) => t.dataSources && t.status === "UNCLAIMED" && !census.has(normName(t.name)) && t.publishedAt
  )
  if (!dryRun && orphans.length) {
    await prisma.tenant.updateMany({
      where: { id: { in: orphans.map((o) => o.id) } },
      data: { publishedAt: null, dataNotes: "no longer present in the census - review" },
    })
  }
  console.log(`orphans ${dryRun ? "found" : "unpublished"}: ${orphans.length}`)
  orphans.slice(0, 5).forEach((o) => console.log(`   ${o.name.slice(0, 46)}`))

  // ---- unsupported rows -------------------------------------------------------
  // Standings pages and search sweeps produce names with nothing behind them:
  // "17 Ignite", "1 of 1", "and Club of Ottawa". Those sources are fine as
  // CORROBORATION - most rows carrying them are also in the census and are real
  // clubs - but a row resting on them ALONE, with no town, contact, website or
  // coordinates, is not something anyone can claim or contact. Unpublished, not
  // deleted, so the names stay available if a later pass can substantiate them.
  const WEAK_SOURCES = new Set(["league-harvest", "browser-sweep", "obl-teams", "jrnba-2019"])
  const unsupported = fresh.filter((t) => {
    if (t.status !== "UNCLAIMED" || !t.publishedAt || !t.dataSources) return false
    const srcs = t.dataSources.split(",").map((x) => x.trim()).filter(Boolean)
    if (!srcs.length || !srcs.every((x) => WEAK_SOURCES.has(x))) return false
    // A town does not rescue such a row: the weak sources often recorded a guess
    // ("possibly Kanata area", "unconfirmed abbreviation") in the city field, so
    // the only thing that counts as substance here is a way to reach the club.
    return !t.contactEmail && !t.phoneNumber && !t.website
  })
  if (!dryRun && unsupported.length) {
    await prisma.tenant.updateMany({
      where: { id: { in: unsupported.map((o) => o.id) } },
      data: { publishedAt: null, dataNotes: "name only, from a standings/sweep source - needs evidence" },
    })
  }
  console.log(`unsupported ${dryRun ? "found" : "unpublished"}: ${unsupported.length}`)
  unsupported.slice(0, 8).forEach((o) => console.log(`   ${o.name.slice(0, 46)}`))

  // ---- hedged towns -----------------------------------------------------------
  // A few rows recorded the researcher's uncertainty in the city column
  // ("possibly Kanata area", "unconfirmed abbreviation"). Those strings were then
  // geocoded, so the coordinates point at whatever Google made of the sentence.
  // Move the note where notes belong and clear both, putting the row in the
  // console's missing-city queue where someone can settle it.
  const HEDGE = /\b(possibly|likely|unconfirmed|not confirmed|probably|assumed|unknown|maybe|suggests)\b/i
  const hedged = await prisma.tenant.findMany({
    where: { mergedIntoId: null, city: { not: null } },
    select: { id: true, name: true, city: true, latitude: true, dataNotes: true },
  })
  const guesses = hedged.filter((t) => HEDGE.test(t.city || ""))
  if (!dryRun) {
    for (const g of guesses) {
      await prisma.tenant.update({
        where: { id: g.id },
        data: {
          city: null,
          latitude: null,
          longitude: null,
          geocodedAt: null,
          geoPrecision: null,
          dataNotes: [g.dataNotes, `unverified location: ${g.city}`].filter(Boolean).join(" | "),
        },
      })
    }
  }
  console.log(`hedged towns ${dryRun ? "found" : "cleared"}: ${guesses.length}`)

  console.log(`\n${dryRun ? "WOULD MERGE" : "merged"}   ${merged}`)
  console.log(`skipped (claimed)  ${skippedClaimed}`)
  console.log(`skipped (different town) ${crossCity.length}`)
  crossCity.slice(0, 6).forEach((c) => console.log(`   ${c.slice(0, 70)}`))
  console.log(`no survivor found  ${noSurvivor}`)
  if (failures.length) {
    console.log(`\nfailures (${failures.length}):`)
    failures.slice(0, 10).forEach((f) => console.log("  ", f))
  }
  if (!dryRun) {
    const [total, active] = await Promise.all([
      prisma.tenant.count({ where: { mergedIntoId: null } }),
      prisma.tenant.count({ where: { mergedIntoId: { not: null } } }),
    ])
    console.log(`\nlive tenants ${total}, merged away ${active}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
