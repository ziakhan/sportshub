/**
 * The season's saved calendar and its gym grid, byte-comparable. The whole point
 * of the plan-world architecture is that editing a plan the season does not run
 * leaves BOTH of these untouched, so the drives take this before and after.
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const seasonId = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"

const sessions = await prisma.seasonSession.findMany({
  where: { seasonId },
  select: {
    id: true, phase: true, unitKeys: true, unitVenues: true, targetGamesPerTeam: true,
    days: {
      orderBy: { date: "asc" },
      select: {
        date: true,
        dayVenues: {
          orderBy: { venueId: "asc" },
          select: { venueId: true, startTime: true, endTime: true, bookingStatus: true,
                    courts: { orderBy: { courtId: "asc" }, select: { courtId: true } } },
        },
      },
    },
  },
  orderBy: { id: "asc" },
})
const divisions = await prisma.division.findMany({
  where: { seasonId }, select: { id: true, ageGroup: true, expectedTeams: true }, orderBy: { id: "asc" },
})
const venues = await prisma.seasonVenue.findMany({
  where: { seasonId },
  select: { id: true, venueId: true, role: true, courtsAvailable: true,
            hours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, openTime: true, closeTime: true } } },
  orderBy: { venueId: "asc" },
})
const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { courtBuffer: true, status: true } })
const plans = await prisma.seasonPlan.findMany({
  where: { seasonId }, select: { id: true, name: true, source: true, isActive: true }, orderBy: { id: "asc" },
})
console.log(JSON.stringify({ season, divisions, venues, sessions, plans }, null, 1))
await prisma.$disconnect()
