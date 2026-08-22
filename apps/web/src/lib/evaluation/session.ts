import { prisma } from "@youthbasketballhub/db"
import { isClubAdmin } from "@/lib/authz/team-scope"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MEASURABLES,
  DEFAULT_TEMPLATE_NAME,
} from "./default-template"
import { consolidate, evaluatorDeviations, type CategoryWeight, type RatingInput } from "./scoring"

const db = prisma as any

/**
 * ONE platform template, inherited by every club (owner 2026-08-21). It is
 * created lazily on first use and identified by `tenantId: null`. A club that
 * wants more adds its own categories on top; nobody can delete a base one,
 * because the base is what keeps a rating comparable across clubs and across
 * years.
 */
export async function ensurePlatformTemplate() {
  const existing = await db.evaluationTemplate.findFirst({
    where: { tenantId: null },
    include: { categories: true, measurables: true },
  })
  if (existing) return existing

  return db.evaluationTemplate.create({
    data: {
      tenantId: null,
      name: DEFAULT_TEMPLATE_NAME,
      categories: {
        create: DEFAULT_CATEGORIES.map((c, i) => ({
          key: c.key,
          label: c.label,
          hint: c.hint,
          anchors: c.anchors,
          weight: c.weight,
          sortOrder: i,
          isBase: true,
        })),
      },
      measurables: {
        create: DEFAULT_MEASURABLES.map((m, i) => ({
          key: m.key,
          label: m.label,
          unit: m.unit,
          higherIsBetter: m.higherIsBetter,
          sortOrder: i,
        })),
      },
    },
    include: { categories: true, measurables: true },
  })
}

/** The session for an event, created on demand in DRAFT. */
export async function ensureSessionForEvent(eventId: string) {
  const event = await db.tryoutEvent.findUnique({
    where: { id: eventId },
    select: { id: true, tenantId: true, seasonLabel: true },
  })
  if (!event) return null

  const existing = await db.evaluationSession.findFirst({ where: { eventId } })
  if (existing) return existing

  const template = await ensurePlatformTemplate()
  return db.evaluationSession.create({
    data: {
      tenantId: event.tenantId,
      eventId: event.id,
      templateId: template.id,
      seasonLabel: event.seasonLabel,
    },
  })
}

export async function loadSession(sessionId: string) {
  return db.evaluationSession.findUnique({
    where: { id: sessionId },
    include: {
      event: { select: { id: true, title: true, tenantId: true, seasonLabel: true } },
      template: {
        include: {
          categories: { where: { enabled: true }, orderBy: { sortOrder: "asc" } },
          measurables: { where: { enabled: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  })
}

export interface RosterEntry {
  poolMemberId: string
  ageGroup: string
  name: string
  number: number
  assigned: boolean
}

/** Everyone in the pools this event feeds, which is who can be scored. */
export async function sessionRoster(session: {
  tenantId: string
  seasonLabel: string
}): Promise<RosterEntry[]> {
  const members = await db.tryoutPoolMember.findMany({
    where: { tenantId: session.tenantId, seasonLabel: session.seasonLabel },
    select: {
      id: true,
      ageGroup: true,
      teamId: true,
      player: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true } },
    },
    orderBy: [{ ageGroup: "asc" }, { createdAt: "asc" }],
  })
  return members.map((m: any, i: number) => ({
    poolMemberId: m.id,
    ageGroup: m.ageGroup,
    name: `${m.player.firstName} ${m.player.lastName}`,
    /** Pinnies are how a coach identifies a kid across a gym; the roster
     *  index is the fallback when the club has not assigned numbers. */
    number: m.player.jerseyNumber ?? i + 1,
    assigned: Boolean(m.teamId),
  }))
}

export interface ReportView {
  canSeeAttribution: boolean
  canSeeOthers: boolean
  rows: ReturnType<typeof consolidate>
  deviations: ReturnType<typeof evaluatorDeviations>
  evaluators: { id: string; name: string }[]
  roster: RosterEntry[]
}

/**
 * The consolidated report, filtered to what this viewer is allowed to see.
 *
 * Visibility is the club's dial, not ours (owner 2026-08-21). The one thing
 * the platform fixes is that a club admin always sees everything attributed:
 * anonymity to peers, never to the person accountable for the decision.
 */
export async function buildReport(sessionId: string, viewerId: string): Promise<ReportView | null> {
  const session = await loadSession(sessionId)
  if (!session) return null

  const admin = await isClubAdmin(viewerId, session.tenantId)
  const canSeeOthers = admin || session.visibility !== "PRIVATE"
  const canSeeAttribution = admin || session.visibility === "OPEN"

  const ratings = await db.evaluationRating.findMany({
    where: { sessionId },
    select: {
      poolMemberId: true,
      evaluatorId: true,
      score: true,
      isPrivate: true,
      category: { select: { key: true } },
    },
  })

  // In PRIVATE a non-admin sees only their own work. Everywhere else the
  // aggregate includes every rating, including ones marked private by their
  // author: those still count, only the attribution is withheld.
  const visible = canSeeOthers ? ratings : ratings.filter((r: any) => r.evaluatorId === viewerId)

  const inputs: RatingInput[] = visible.map((r: any) => ({
    playerId: r.poolMemberId,
    evaluatorId: r.evaluatorId,
    categoryKey: r.category.key,
    score: r.score,
  }))

  const weights: CategoryWeight[] = session.template.categories.map((c: any) => ({
    key: c.key,
    label: c.label,
    weight: c.weight,
  }))

  const rows = consolidate(inputs, weights)

  const evaluatorIds = [...new Set(ratings.map((r: any) => r.evaluatorId))] as string[]
  const users = evaluatorIds.length
    ? await db.user.findMany({
        where: { id: { in: evaluatorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []

  return {
    canSeeAttribution,
    canSeeOthers,
    rows,
    // Only ever shown to a club admin: the product surfaces, it never accuses.
    deviations: admin ? evaluatorDeviations(rows) : [],
    evaluators: users.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    roster: await sessionRoster(session),
  }
}
