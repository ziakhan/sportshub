/**
 * Import clubs from CSV as UNCLAIMED tenants.
 *
 * Usage:
 *   export PATH="/usr/local/opt/node@18/bin:$PATH"
 *   npx tsx scripts/import-clubs.ts
 *
 * For production:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/import-clubs.ts
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50)
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || "").trim()
    })
    rows.push(row)
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function extractCity(cityOrAddress: string): string {
  // Handle cases like "Toronto (GTA-wide)" or "Toronto East / Beaches"
  return cityOrAddress
    .replace(/\(.*\)/, "")
    .replace(/\/.*/, "")
    .trim() || "Toronto"
}

function extractProvince(address: string): string {
  // Try to find ON, BC, etc. in the address
  const match = address.match(/,\s*([A-Z]{2})\s/)
  return match ? match[1] : "ON"
}

async function main() {
  const csvPath = path.join(__dirname, "..", "docs", "ontario-basketball-clubs.csv")
  const content = fs.readFileSync(csvPath, "utf-8")
  const rows = parseCSV(content)

  console.log(`Found ${rows.length} clubs in CSV`)

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    const name = row["Club Name"]
    if (!name) continue

    const slug = slugify(name)

    // Check if tenant already exists
    const existing = await prisma.tenant.findUnique({ where: { slug } })
    if (existing) {
      console.log(`  SKIP: ${name} (slug "${slug}" already exists)`)
      skipped++
      continue
    }

    const city = extractCity(row["City"] || "Toronto")
    const address = row["Address"] || ""
    const phone = row["Phone"] || ""
    const email = row["Email"] || ""
    const website = row["Website"] || ""
    const programs = row["Programs"] || ""
    const leagues = row["Leagues"] || ""
    const notes = row["Notes"] || ""
    const region = row["Region"] || ""

    // Build description from available info
    const descParts = []
    if (programs) descParts.push(`Programs: ${programs}`)
    if (leagues) descParts.push(`Leagues: ${leagues}`)
    if (notes) descParts.push(notes)
    const description = descParts.join(". ") || null

    try {
      await prisma.tenant.create({
        data: {
          name,
          slug,
          description,
          phoneNumber: phone || null,
          contactEmail: email && email !== "via website" ? email : null,
          address: address || null,
          city: city || null,
          state: extractProvince(address),
          zipCode: null,
          country: "CA",
          currency: "CAD",
          website: website || null,
          timezone: "America/Toronto",
          status: "UNCLAIMED",
          plan: "FREE",
          branding: {
            create: {
              primaryColor: "#1a73e8",
              secondaryColor: "#34a853",
              accentColor: "#fbbc04",
              fontFamily: "Inter",
            },
          },
          features: {
            create: {
              enableReviews: true,
              enableTournaments: false,
              enableChat: false,
              enableAnalytics: false,
              maxTeams: 10,
              maxStaff: 5,
              maxVenues: 3,
            },
          },
        },
      })
      console.log(`  OK: ${name} → ${slug}`)
      imported++
    } catch (err) {
      console.error(`  ERROR: ${name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone: ${imported} imported, ${skipped} skipped`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
