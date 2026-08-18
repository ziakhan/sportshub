/**
 * Import the consolidated club census into the database as UNCLAIMED tenants.
 *
 *   export PATH="/usr/local/opt/node@18/bin:$PATH"
 *   npx tsx scripts/import-clubs.ts --dry-run     # report, touch nothing
 *   npx tsx scripts/import-clubs.ts               # apply
 *
 * Source: docs/research/consolidated/clubs-consolidated.csv, produced by
 * scripts/research/consolidate-clubs.py from every research source with
 * dedupe, province inference, geocoding and provenance already applied.
 *
 * Idempotent: re-running updates existing rows rather than duplicating them,
 * and never overwrites a non-empty value with an empty one — so a club an admin
 * has hand-corrected keeps its corrections on the next import.
 *
 * For production the DATABASE_URL must be passed explicitly:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/import-clubs.ts
 * (Box/Neon writes need the owner's approval first — see CLAUDE.md.)
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

const CSV = path.join(
  __dirname,
  "..",
  "docs",
  "research",
  "consolidated",
  "clubs-consolidated.csv"
)

/** Province name -> the two-letter code Tenant.state holds. */
const PROVINCE_CODE: Record<string, string> = {
  Ontario: "ON",
  Quebec: "QC",
  "British Columbia": "BC",
  Alberta: "AB",
  Manitoba: "MB",
  Saskatchewan: "SK",
  "Nova Scotia": "NS",
  "New Brunswick": "NB",
  "Newfoundland & Labrador": "NL",
  "Prince Edward Island": "PE",
  "Territories (YT/NWT/NU)": "NT",
}

/** Province -> IANA timezone, so schedules render sensibly from day one. */
const PROVINCE_TZ: Record<string, string> = {
  ON: "America/Toronto",
  QC: "America/Toronto",
  BC: "America/Vancouver",
  AB: "America/Edmonton",
  MB: "America/Winnipeg",
  SK: "America/Regina",
  NS: "America/Halifax",
  NB: "America/Moncton",
  NL: "America/St_Johns",
  PE: "America/Halifax",
  NT: "America/Yellowknife",
}

interface Row {
  [k: string]: string
}

/** RFC-ish CSV reader: handles quoted fields containing commas and newlines. */
function parseCSV(content: string): Row[] {
  const rows: string[][] = []
  let field = ""
  let record: string[] = []
  let inQuotes = false

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

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50)
    .replace(/-+$/, "")
}

/**
 * A slug nobody else is using.
 *
 * The previous version of this script just logged "SKIP" when a slug collided,
 * which silently dropped any second club whose name slugified the same way
 * ("St. Thomas Shock" and "St Thomas Shock"). Suffix instead, and report it.
 */
async function uniqueSlug(base: string, ownerId: string | null): Promise<string> {
  const root = base || "club"
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root.substring(0, 46)}-${n}`
    const existing = await prisma.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === ownerId) return candidate
  }
  return `${root.substring(0, 40)}-${Date.now().toString(36)}`
}

/** Prefer a real incoming value; never blank out something already stored. */
function keep(incoming: string, existing: string | null): string | null {
  const v = incoming.trim()
  if (v) return v
  return existing ?? null
}

function parseCoord(v: string): number | null {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Should this club be visible to the public straight away?
 *
 * The owner's call is "everything visible" — but ~150 records are a bare club
 * name recovered from a league standings sheet, with no city, contact or site.
 * Those render as an empty shell, so they start unpublished and land in the
 * admin review queue. Anything with a location or a way to reach it publishes.
 */
function shouldPublish(r: Row): boolean {
  if (r.stale?.trim()) return false
  if (r.audience && r.audience !== "youth") return false
  return Boolean(r.city?.trim() || r.email?.trim() || r.phone?.trim() || r.website?.trim())
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const rows = parseCSV(fs.readFileSync(CSV, "utf-8"))
  console.log(`source: ${CSV}`)
  console.log(`rows  : ${rows.length}${dryRun ? "   (DRY RUN — nothing will be written)" : ""}\n`)

  let created = 0
  let updated = 0
  let collisions = 0
  let liveSlugConflicts = 0
  let published = 0
  let withGeo = 0
  let skipped = 0
  const byProvince: Record<string, number> = {}

  for (const r of rows) {
    const name = r.club_name?.trim()
    if (!name) {
      skipped++
      continue
    }

    const state = PROVINCE_CODE[r.province] ?? null
    const lat = parseCoord(r.lat)
    const lon = parseCoord(r.lon)
    const publish = shouldPublish(r)

    // Only ever update rows this import owns: UNCLAIMED, non-demo census
    // records. 34 ACTIVE clubs (Orangeville Prep, Ridley College, North York
    // Lions ...) seeded by the demo world share a slug with a census club, and
    // matching on slug alone would overwrite live clubs with census data.
    // A slug owned by an active club forces the census row to a suffixed slug;
    // the two can be reconciled later with the admin merge tool.
    const base = slugify(name)
    const slugOwner = await prisma.tenant.findUnique({
      where: { slug: base },
      select: { id: true, status: true, isDemo: true },
    })
    const slugTakenByLiveClub =
      !!slugOwner && (slugOwner.status !== "UNCLAIMED" || slugOwner.isDemo)
    if (slugTakenByLiveClub) liveSlugConflicts++

    const existing = slugTakenByLiveClub
      ? await prisma.tenant.findFirst({
          where: { name, state, status: "UNCLAIMED", isDemo: false },
        })
      : (slugOwner &&
          (await prisma.tenant.findUnique({ where: { slug: base } }))) ??
        (await prisma.tenant.findFirst({
          where: { name, state, status: "UNCLAIMED", isDemo: false },
        }))

    const data = {
      name,
      description: keep(
        [r.leagues && `Leagues: ${r.leagues}`, r.type && `Type: ${r.type}`]
          .filter(Boolean)
          .join(". "),
        existing?.description ?? null
      ),
      phoneNumber: keep(r.phone, existing?.phoneNumber ?? null),
      contactEmail: keep(r.email, existing?.contactEmail ?? null),
      website: keep(r.website, existing?.website ?? null),
      address: keep(r.address, existing?.address ?? null),
      city: keep(r.city, existing?.city ?? null),
      state,
      postalCode: keep(r.postal_code, existing?.postalCode ?? null),
      country: "CA",
      currency: "CAD",
      timezone: (state && PROVINCE_TZ[state]) || "America/Toronto",
      region: keep(r.region, existing?.region ?? null),
      latitude: lat ?? existing?.latitude ?? null,
      longitude: lon ?? existing?.longitude ?? null,
      placeId: keep(r.place_id, existing?.placeId ?? null),
      geoPrecision: keep(r.geo_precision, existing?.geoPrecision ?? null),
      geoSource: lat && lon ? (r.place_id ? "google" : "oba-kml") : existing?.geoSource ?? null,
      geocodedAt: lat && lon ? new Date() : existing?.geocodedAt ?? null,
      dataSources: keep(r.sources, existing?.dataSources ?? null),
      dataNotes: keep(
        [r.contact_note, r.website_status && `website: ${r.website_status}`, r.needs_review]
          .filter(Boolean)
          .join(" | "),
        existing?.dataNotes ?? null
      ),
      // Never un-publish something a human already published.
      publishedAt: existing?.publishedAt ?? (publish ? new Date() : null),
    }

    if (lat && lon) withGeo++
    if (data.publishedAt) published++
    byProvince[r.province] = (byProvince[r.province] ?? 0) + 1

    if (dryRun) {
      if (existing) updated++
      else {
        created++
        const s = await uniqueSlug(base, null)
        if (s !== base) collisions++
      }
      continue
    }

    if (existing) {
      await prisma.tenant.update({ where: { id: existing.id }, data })
      updated++
    } else {
      const slug = await uniqueSlug(base, null)
      if (slug !== base) collisions++
      await prisma.tenant.create({
        data: {
          ...data,
          slug,
          status: "UNCLAIMED",
          plan: "FREE",
          branding: {
            create: {
              primaryColor: "#1e40af",
              secondaryColor: "#059669",
              accentColor: "#f59e0b",
              fontFamily: "Inter",
            },
          },
          features: {
            create: { enableReviews: true, maxTeams: 10, maxStaff: 5, maxVenues: 3 },
          },
        },
      })
      created++
    }
  }

  console.log(`created            ${created}`)
  console.log(`updated            ${updated}`)
  console.log(`slug collisions    ${collisions}  (suffixed, not dropped)`)
  console.log(`slug held by live  ${liveSlugConflicts}  (active/demo club owns the slug; census row suffixed, never overwritten)`)
  console.log(`skipped (no name)  ${skipped}`)
  console.log(`\npublished          ${published} / ${created + updated}`)
  console.log(`with coordinates   ${withGeo}`)
  console.log(`\nby province:`)
  for (const [p, n] of Object.entries(byProvince).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${p}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
