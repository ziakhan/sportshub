import { prisma } from "@youthbasketballhub/db"
import { todayUtcDateFloor } from "@/lib/calendar/timezone"

/**
 * Public programs aggregation — tryouts, house leagues, camps and
 * tournaments in one date-sorted list. Single source for the public
 * /events page AND the native app's Browse → Programs screen
 * (GET /api/mobile/browse/programs), so the two can never drift.
 */

export interface EventItem {
  id: string
  type: "tryout" | "house-league" | "camp" | "tournament"
  name: string
  clubName: string
  clubSlug: string
  ageGroup: string
  gender: string | null
  startDate: string
  endDate?: string
  location: string
  fee: number
  currency: string
  primaryColor: string
  spotsInfo: string
  extra?: string
  status?: string
  feeUnit?: string
  href: string
}

const TYPE_LABELS: Record<string, string> = {
  MARCH_BREAK: "March Break",
  HOLIDAY: "Holiday",
  SUMMER: "Summer",
  WEEKLY: "Weekly",
}

const tenantSelect = {
  select: {
    name: true,
    slug: true,
    currency: true,
    branding: { select: { primaryColor: true } },
  },
} as const

export async function getAllPrograms(): Promise<EventItem[]> {
  const today = todayUtcDateFloor()
  const [tryouts, houseLeagues, camps, tournaments] = await Promise.all([
    // Same filters as GET /api/tryouts?marketplace=true
    prisma.tryout.findMany({
      where: { isPublished: true, isPublic: true, scheduledAt: { gte: new Date() } },
      include: { tenant: tenantSelect, _count: { select: { signups: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    // Same filters as GET /api/house-leagues?public=true
    prisma.houseLeague.findMany({
      where: { isPublished: true, endDate: { gte: today } },
      include: { tenant: tenantSelect, _count: { select: { signups: true } } },
      orderBy: { startDate: "asc" },
    }),
    // Same filters as GET /api/camps?public=true
    prisma.camp.findMany({
      where: { isPublished: true, endDate: { gte: today } },
      include: { tenant: tenantSelect, _count: { select: { signups: true } } },
      orderBy: { startDate: "asc" },
    }),
    // Same filters as GET /api/tournaments?public=true
    prisma.tournament.findMany({
      where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] }, startDate: { gte: today } },
      include: { divisions: true, _count: { select: { teams: true } } },
      orderBy: { startDate: "asc" },
    }),
  ])

  const items: EventItem[] = []

  for (const t of tryouts) {
    items.push({
      id: t.id,
      type: "tryout",
      name: t.title,
      clubName: t.tenant?.name || "",
      clubSlug: t.tenant?.slug || "",
      ageGroup: t.ageGroup,
      gender: t.gender,
      startDate: t.scheduledAt.toISOString(),
      location: t.location,
      fee: Number(t.fee),
      currency: t.tenant?.currency || "CAD",
      primaryColor: t.tenant?.branding?.primaryColor || "#f97316",
      spotsInfo: `${t._count.signups}${t.maxParticipants ? `/${t.maxParticipants}` : ""} signed up`,
      href: `/tryout/${t.id}`,
    })
  }

  for (const l of houseLeagues) {
    items.push({
      id: l.id,
      type: "house-league",
      name: l.name,
      clubName: l.tenant?.name || "",
      clubSlug: l.tenant?.slug || "",
      ageGroup: (l.ageGroups || "").split(",").join(", "),
      gender: l.gender,
      startDate: l.startDate.toISOString(),
      endDate: l.endDate.toISOString(),
      location: l.location,
      fee: Number(l.fee),
      currency: l.tenant?.currency || "CAD",
      primaryColor: l.tenant?.branding?.primaryColor || "#f97316",
      spotsInfo: `${l._count.signups}${l.maxParticipants ? `/${l.maxParticipants}` : ""} registered`,
      extra: `${l.daysOfWeek} ${l.startTime}-${l.endTime}`,
      href: `/house-league/${l.id}`,
    })
  }

  for (const c of camps) {
    items.push({
      id: c.id,
      type: "camp",
      name: c.name,
      clubName: c.tenant?.name || "",
      clubSlug: c.tenant?.slug || "",
      ageGroup: c.ageGroup,
      gender: c.gender,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      location: c.location,
      fee: Number(c.weeklyFee),
      currency: c.tenant?.currency || "CAD",
      primaryColor: c.tenant?.branding?.primaryColor || "#f97316",
      spotsInfo: `${c._count.signups}${c.maxParticipants ? `/${c.maxParticipants}` : ""} registered`,
      extra: `${TYPE_LABELS[c.campType] || c.campType} • ${c.numberOfWeeks} week${c.numberOfWeeks !== 1 ? "s" : ""}`,
      href: `/camp/${c.id}`,
    })
  }

  for (const t of tournaments) {
    const ageGroups = [...new Set(t.divisions.map((d: any) => d.ageGroup))].filter(Boolean)
    const teamCount = t._count.teams
    items.push({
      id: t.id,
      type: "tournament",
      name: t.name,
      clubName: "",
      clubSlug: "",
      ageGroup: ageGroups.join(", "),
      gender: null,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      location: `${t.city}${t.state ? `, ${t.state}` : ""}`,
      fee: Number(t.teamFee || 0),
      currency: t.currency || "CAD",
      primaryColor: "#f97316",
      spotsInfo: `${teamCount} team${teamCount !== 1 ? "s" : ""} registered`,
      extra: `${t.gamesGuaranteed} games guaranteed`,
      status: t.status,
      feeUnit: "per team",
      href: `/tournament/${t.id}`,
    })
  }

  items.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  return items
}
