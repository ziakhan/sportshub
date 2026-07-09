/**
 * ENRICH DEMO CLUBS — make a couple of demo clubs look fully functional so the
 * redesigned public page shows every block populated (for screen recordings).
 *
 * Idempotent: safe to run repeatedly. For each target club it ensures branding
 * (tagline + socials), contact details, ~3 announcements (1 pinned), an open
 * tryout + house league + camp (published, future-dated), and >=3 reviews. Also
 * ensures a demo Scorekeeper account exists so the scorekeeper-assignment pool
 * isn't empty.
 *
 *   npx tsx scripts/enrich-demo-clubs.ts
 */

import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"

const TARGET_SLUGS = ["north-toronto-huskies", "west-united"]

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

async function ensureScorekeeperAccount() {
  const email = "scorekeeper@sportshub.demo"
  let user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash("TestPass123!", 12),
        firstName: "Sam",
        lastName: "Scorekeeper",
        status: "ACTIVE",
      },
    })
    console.log(`  + created scorekeeper account ${email} / TestPass123!`)
  }
  const hasRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role: "Scorekeeper", gameId: null },
  })
  if (!hasRole) {
    await prisma.userRole.create({ data: { userId: user.id, role: "Scorekeeper" } })
    console.log(`  + granted global Scorekeeper role to ${email}`)
  }
  return user.id
}

async function enrichClub(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { branding: true },
  })
  if (!tenant) {
    console.log(`! club not found: ${slug} — skipping`)
    return
  }
  console.log(`\n== ${tenant.name} (${slug}) ==`)

  // --- Contact details on the tenant (only fill blanks) ---
  const contactPatch: Record<string, any> = {}
  if (!tenant.description)
    contactPatch.description = `${tenant.name} is a community youth basketball club developing players and people across Toronto. Competitive teams, house-league fun, camps, and a family-first culture.`
  if (!tenant.phoneNumber) contactPatch.phoneNumber = "416-555-0142"
  if (!tenant.contactEmail) contactPatch.contactEmail = `info@${slug.replace(/-/g, "")}.example.com`
  if (!tenant.website) contactPatch.website = `https://${slug.replace(/-/g, "")}.example.com`
  if (!tenant.address) contactPatch.address = "50 Baseline Rd"
  if (!tenant.city) contactPatch.city = "Toronto"
  if (!tenant.state) contactPatch.state = "ON"
  if (!tenant.zipCode) contactPatch.zipCode = "M4B 1B3"
  if (Object.keys(contactPatch).length) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: contactPatch })
    console.log(`  ~ contact details set (${Object.keys(contactPatch).join(", ")})`)
  }

  // --- Branding: tagline + socials (fill blanks; keep primaryColor) ---
  const b: any = tenant.branding
  const socials = (b?.socials as any) || {}
  const socialsPatch = { ...socials }
  if (!socialsPatch.instagram) socialsPatch.instagram = slug.replace(/-/g, "")
  if (!socialsPatch.youtube) socialsPatch.youtube = "https://youtube.com/@youthhoops"
  if (!socialsPatch.facebook) socialsPatch.facebook = slug.replace(/-/g, "")
  await prisma.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      tagline: "Where Toronto's next generation plays.",
      socials: socialsPatch,
    },
    update: {
      tagline: b?.tagline || "Where Toronto's next generation plays.",
      socials: socialsPatch,
    },
  })
  console.log(`  ~ branding tagline + socials ensured`)

  // Author for announcements = a club owner/manager, else any user.
  const ownerRole = await prisma.userRole.findFirst({
    where: { tenantId: tenant.id, role: { in: ["ClubOwner", "ClubManager"] } },
    select: { userId: true },
  })
  const authorId =
    ownerRole?.userId ?? (await prisma.user.findFirst({ select: { id: true } }))!.id

  // --- Announcements (ensure >=3 public, 1 pinned) ---
  const pubAnnouncements = await prisma.announcement.count({
    where: { tenantId: tenant.id, teamId: null, isPublic: true },
  })
  if (pubAnnouncements < 3) {
    const seeds = [
      {
        title: "Fall registration is open",
        content:
          "Tryouts, house league, and our winter break camp are all open for registration. Spots are limited — grab yours from the Programs section below.",
        isPinned: true,
      },
      {
        title: "New: every home game live-scored",
        content:
          "All of our competitive teams' games are now scored live with box scores, stat leaders, and AI recaps. Follow the club to get them on your homepage.",
        isPinned: false,
      },
      {
        title: "Volunteer coaches & scorekeepers wanted",
        content:
          "Love the game and want to give back? We're looking for assistant coaches and game-day scorekeepers this season. Reach out via the contact info on this page.",
        isPinned: false,
      },
    ]
    for (const s of seeds.slice(0, 3 - pubAnnouncements)) {
      await prisma.announcement.create({
        data: { tenantId: tenant.id, authorId, isPublic: true, ...s },
      })
    }
    console.log(`  + announcements added (${3 - pubAnnouncements})`)
  } else {
    console.log(`  = announcements already present (${pubAnnouncements})`)
  }

  // --- Open tryout (published, public, future) ---
  const futureTryout = await prisma.tryout.findFirst({
    where: { tenantId: tenant.id, isPublished: true, isPublic: true, scheduledAt: { gte: new Date() } },
  })
  if (!futureTryout) {
    await prisma.tryout.create({
      data: {
        tenantId: tenant.id,
        title: "Fall Competitive Tryouts — Grades 8–11",
        description:
          "Open tryouts for our fall competitive program. Come showcase your skills — evaluators from every age group will be on hand.",
        ageGroup: "Grades 8-11",
        gender: "MALE",
        location: "Pan Am Sports Centre",
        scheduledAt: new Date(now + 10 * DAY),
        duration: 120,
        fee: 25,
        maxParticipants: 60,
        isPublished: true,
        isPublic: true,
      },
    })
    console.log(`  + tryout created`)
  } else {
    console.log(`  = tryout already present`)
  }

  // --- House league (published, future) ---
  const futureHL = await prisma.houseLeague.findFirst({
    where: { tenantId: tenant.id, isPublished: true, endDate: { gte: new Date() } },
  })
  if (!futureHL) {
    await prisma.houseLeague.create({
      data: {
        tenantId: tenant.id,
        name: "Saturday House League",
        description:
          "Our flagship recreational program — every kid plays, every week. Balanced teams, real refs, and a end-of-season medal for everyone.",
        details: "Includes reversible jersey and end-of-season medal.",
        ageGroups: "U8,U10,U12,U14",
        gender: "COED",
        season: "Fall 2026",
        startDate: new Date(now + 14 * DAY),
        endDate: new Date(now + 100 * DAY),
        daysOfWeek: "Saturday",
        startTime: "09:00",
        endTime: "12:00",
        location: "Central Tech Gym",
        fee: 220,
        maxParticipants: 120,
        includesUniform: true,
        includesMedal: true,
        isPublished: true,
      },
    })
    console.log(`  + house league created`)
  } else {
    console.log(`  = house league already present`)
  }

  // --- Camp (published, future) ---
  const futureCamp = await prisma.camp.findFirst({
    where: { tenantId: tenant.id, isPublished: true, endDate: { gte: new Date() } },
  })
  if (!futureCamp) {
    await prisma.camp.create({
      data: {
        tenantId: tenant.id,
        name: "Winter Break Skills Camp",
        description:
          "Three days of high-rep skill development, small-sided games, and shooting competitions to keep players sharp over the break.",
        details: "Bring indoor shoes, a water bottle, and a ball. Lunch and a t-shirt included.",
        campType: "HOLIDAY",
        ageGroup: "Ages 9-14",
        gender: "COED",
        startDate: new Date(now + 21 * DAY),
        endDate: new Date(now + 35 * DAY),
        dailyStartTime: "09:00",
        dailyEndTime: "15:00",
        location: "Pan Am Sports Centre",
        numberOfWeeks: 2,
        weeklyFee: 199,
        fullCampFee: 349,
        maxParticipants: 40,
        includesLunch: true,
        includesJersey: true,
        includesBall: false,
        isPublished: true,
      },
    })
    console.log(`  + camp created`)
  } else {
    console.log(`  = camp already present`)
  }

  // --- Reviews (ensure >=3 published) ---
  const reviewCount = await prisma.review.count({
    where: { tenantId: tenant.id, status: "PUBLISHED" },
  })
  if (reviewCount < 3) {
    const existingReviewers = (
      await prisma.review.findMany({
        where: { tenantId: tenant.id },
        select: { reviewerId: true },
      })
    ).map((r) => r.reviewerId)
    const reviewers = await prisma.user.findMany({
      where: { id: { notIn: [authorId, ...existingReviewers] } },
      select: { id: true },
      take: 3,
    })
    const seeds = [
      { rating: 5, title: "Great coaches, great communication", content: "Our son improved so much this season. Offers, sizes, and payments were all on our phone — zero paperwork." },
      { rating: 5, title: "Well organized club", content: "Tryout to roster in a week, and we always knew what we owed and when. The team chat keeps everyone in the loop." },
      { rating: 4, title: "Development first", content: "Coaches actually develop every kid on the roster, not just the stars. Live stats after every game are a huge bonus." },
    ]
    const toAdd = Math.min(3 - reviewCount, reviewers.length)
    for (let i = 0; i < toAdd; i++) {
      await prisma.review.create({
        data: { tenantId: tenant.id, reviewerId: reviewers[i].id, status: "PUBLISHED", ...seeds[i] },
      })
    }
    console.log(`  + reviews added (${toAdd})`)
  } else {
    console.log(`  = reviews already present (${reviewCount})`)
  }
}

async function main() {
  console.log("Ensuring demo scorekeeper account…")
  await ensureScorekeeperAccount()
  for (const slug of TARGET_SLUGS) {
    await enrichClub(slug)
  }
  console.log("\nDone. Public pages should now show every block populated.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
