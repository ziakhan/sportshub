import { prisma } from "@youthbasketballhub/db"
import { cache } from "@/lib/queries/request-cache"

/**
 * Role-aware, DATA-DRIVEN onboarding completion checklist.
 *
 * There is no per-user "tour state" to keep in sync — every step's done/not-done
 * is derived from real records (profile fields, a team row, a locked roster, a
 * child, …), so it self-heals: an account created by the seed or via a
 * back-office flow still shows the right progress, and a step can never be
 * "checked" without the underlying thing actually existing.
 *
 * Steps are grouped by journey (account / club / league / referee / family).
 * A user with several roles gets several groups; the shared "Complete your
 * profile" step appears once. `optional` steps (things genuinely outside the
 * user's sole control, e.g. locking a roster requires a league) are shown but
 * excluded from `percent`, so 100% stays reachable and the nag can clear.
 */

export interface ChecklistStep {
  key: string
  /** Journey heading this step renders under. */
  group: string
  label: string
  hint?: string
  href: string
  done: boolean
  /** Recommended-but-not-required: shown, but never counted toward percent. */
  optional?: boolean
}

export interface CompletionChecklist {
  /** 0–100 over REQUIRED steps only. 100 when every required step is done. */
  percent: number
  complete: boolean
  requiredTotal: number
  requiredDone: number
  steps: ChecklistStep[]
  /** First not-done step (required first, then optional) — for a one-tap CTA. */
  nextStep: ChecklistStep | null
  /** True when at least one step applies (i.e. the pill/card should render). */
  applicable: boolean
}

/** Default seeded brand colour — a club that never changed it isn't "branded". */
const DEFAULT_PRIMARY_COLOR = "#1a73e8"

const ACCOUNT_GROUP = "Your account"
const CLUB_GROUP = "Your club"
const LEAGUE_GROUP = "Your league"
const REFEREE_GROUP = "Referee setup"
const TRAINER_GROUP = "Trainer setup"
const FAMILY_GROUP = "Your family"

interface UserLike {
  id: string
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  city: string | null
  roles: Array<{
    role: string
    tenantId: string | null
    teamId?: string | null
    leagueId: string | null
  }>
}

const COMPLETE_ADMIN: CompletionChecklist = {
  percent: 100,
  complete: true,
  requiredTotal: 0,
  requiredDone: 0,
  steps: [],
  nextStep: null,
  applicable: false,
}

/**
 * Build the checklist for an already-loaded user (the `getCurrentUser()` shape:
 * roles with tenant/team/league scope ids). Memoized per request so the top-nav
 * pill and the dashboard card share a single computation.
 */
export const getCompletionChecklist = cache(async function getCompletionChecklist(
  user: UserLike
): Promise<CompletionChecklist> {
  const roleSet = new Set(user.roles.map((r) => r.role))

  // Platform admins have no setup journey.
  if (roleSet.has("PlatformAdmin")) return COMPLETE_ADMIN

  const hasClub = roleSet.has("ClubOwner") || roleSet.has("ClubManager")
  const hasLeague = roleSet.has("LeagueOwner") || roleSet.has("LeagueManager")
  const hasReferee = roleSet.has("Referee")
  const hasTrainer = roleSet.has("Trainer")
  const hasParent = roleSet.has("Parent")

  const primaryTenantId =
    user.roles.find((r) => (r.role === "ClubOwner" || r.role === "ClubManager") && r.tenantId)
      ?.tenantId ?? null
  const trainerTenantId =
    user.roles.find((r) => r.role === "Trainer" && r.tenantId)?.tenantId ?? null
  const leagueRoleIds = user.roles
    .filter((r) => (r.role === "LeagueOwner" || r.role === "LeagueManager") && r.leagueId)
    .map((r) => r.leagueId as string)

  const [club, league, referee, trainer, family] = await Promise.all([
    hasClub && primaryTenantId ? loadClub(primaryTenantId) : Promise.resolve(null),
    hasLeague ? loadLeague(user.id, leagueRoleIds) : Promise.resolve(null),
    hasReferee ? loadReferee(user.id) : Promise.resolve(null),
    hasTrainer && trainerTenantId ? loadTrainer(trainerTenantId) : Promise.resolve(null),
    hasParent ? loadFamily(user.id) : Promise.resolve(null),
  ])

  const steps: ChecklistStep[] = []

  // Universal: complete your profile (every non-admin journey needs this once).
  const profileDone =
    !!user.firstName && !!user.lastName && !!user.phoneNumber && !!user.city
  steps.push({
    key: "profile",
    group: ACCOUNT_GROUP,
    label: "Complete your profile",
    hint: "Add your name, phone, and city so clubs and teammates can reach you.",
    href: "/settings/profile",
    done: profileDone,
  })

  if (hasClub) {
    const base = primaryTenantId ? `/clubs/${primaryTenantId}` : "/clubs/create"
    steps.push(
      {
        key: "club-create",
        group: CLUB_GROUP,
        label: "Create your club",
        hint: "Set up your club — teams, tryouts, and offers all live under it.",
        href: "/clubs/create",
        // The ClubOwner role is granted at signup but unscoped; it gets a
        // tenantId only once the club row exists. So "has a club" == has a
        // tenant-scoped club role == primaryTenantId is set.
        done: !!primaryTenantId,
      },
      {
        key: "club-brand",
        group: CLUB_GROUP,
        label: "Brand your club",
        hint: "Add a logo and set your team colors.",
        // QA-405: Customize is the visual brand editor (logo + all three
        // colors, live preview) — Settings only has the primary color.
        href: primaryTenantId ? `${base}/customize` : "/clubs/create",
        done: !!club?.branded,
      },
      {
        key: "club-team",
        group: CLUB_GROUP,
        label: "Create your first team",
        hint: "Teams are how you run tryouts and send offers.",
        href: primaryTenantId ? `${base}/teams/create` : "/clubs/create",
        done: !!club?.hasTeam,
      },
      {
        key: "club-staff",
        group: CLUB_GROUP,
        label: "Assign a coach",
        hint: "Invite or assign staff and hand off day-to-day work.",
        href: primaryTenantId ? `${base}/staff` : "/clubs/create",
        done: !!club?.hasStaff,
        optional: true,
      },
      {
        key: "club-tryout",
        group: CLUB_GROUP,
        label: "Post a tryout",
        hint: "Open registration so players can sign up.",
        href: primaryTenantId ? `${base}/tryouts/create` : "/clubs/create",
        done: !!club?.hasTryout,
      },
      {
        key: "club-roster",
        group: CLUB_GROUP,
        label: "Finalize a roster",
        hint: "Lock a team's roster for a league season.",
        href: primaryTenantId ? `${base}/teams` : "/clubs/create",
        done: !!club?.hasLockedRoster,
        optional: true,
      },
      {
        key: "club-payments",
        group: CLUB_GROUP,
        label: "Connect payments",
        hint: "Accept fees online with Stripe — or keep collecting offline.",
        href: primaryTenantId ? `${base}/payments` : "/settings/payments",
        done: !!club?.paymentsConnected,
        optional: true,
      }
    )
  }

  if (hasLeague) {
    const lid = league?.primaryLeagueId
    // NOTE: there is no /seasons index page — season creation lives on the league detail.
    const seasonsHref = lid ? `/manage/leagues/${lid}` : "/manage/leagues/create"
    steps.push(
      {
        key: "league-create",
        group: LEAGUE_GROUP,
        label: "Create your league",
        hint: "Name your league and set it up.",
        href: "/manage/leagues/create",
        done: !!league?.hasLeague,
      },
      {
        key: "league-season",
        group: LEAGUE_GROUP,
        label: "Add a season",
        hint: "Set fees, dates, and the registration deadline.",
        href: seasonsHref,
        done: !!league?.hasSeason,
      },
      {
        key: "league-divisions",
        group: LEAGUE_GROUP,
        label: "Set up divisions",
        hint: "Group teams by age and tier.",
        href:
          lid && league?.primarySeasonId
            ? `/manage/leagues/${lid}/seasons/${league.primarySeasonId}/manage`
            : seasonsHref,
        done: !!league?.hasDivision,
      }
    )
  }

  if (hasReferee) {
    steps.push(
      {
        key: "referee-profile",
        group: REFEREE_GROUP,
        label: "Set up your referee profile",
        hint: "Set your certification level and standard fee.",
        href: "/referee/profile",
        done: !!referee?.hasProfile,
      },
      {
        key: "referee-availability",
        group: REFEREE_GROUP,
        label: "Add your availability",
        hint: "Tell leagues which days you can officiate.",
        href: "/referee/requests",
        done: !!referee?.hasAvailability,
      }
    )
  }

  if (hasTrainer) {
    const tBase = trainerTenantId ? `/clubs/${trainerTenantId}` : "/trainers/create"
    steps.push(
      {
        key: "trainer-create",
        group: TRAINER_GROUP,
        label: "Set up your trainer profile",
        hint: "Your public page, programs, and bookings all hang off it.",
        href: "/trainers/create",
        done: !!trainerTenantId,
      },
      {
        key: "trainer-program",
        group: TRAINER_GROUP,
        label: "Publish your first program",
        hint: "A camp, clinic, or group session families can register for.",
        href: trainerTenantId ? `${tBase}/training` : "/trainers/create",
        done: !!trainer?.hasProgram,
      },
      {
        key: "trainer-one-on-one",
        group: TRAINER_GROUP,
        label: "Open 1-on-1 booking",
        hint: "Set your session length and fee, then add availability.",
        href: trainerTenantId ? `${tBase}/one-on-one` : "/trainers/create",
        done: !!trainer?.oneOnOneEnabled,
        optional: true,
      }
    )
  }

  if (hasParent) {
    steps.push(
      {
        key: "family-child",
        group: FAMILY_GROUP,
        label: "Add your child",
        hint: "Register a player to track their teams, tryouts, and offers.",
        href: "/players/add",
        done: !!family?.hasChild,
      },
      {
        key: "family-register",
        group: FAMILY_GROUP,
        label: "Find a program",
        hint: "Sign up for a tryout, camp, or league.",
        href: "/marketplace",
        done: !!family?.hasEngagement,
        optional: true,
      }
    )
  }

  const applicable = steps.length > 0
  const required = steps.filter((s) => !s.optional)
  const requiredTotal = required.length
  const requiredDone = required.filter((s) => s.done).length
  const percent = requiredTotal === 0 ? 100 : Math.round((requiredDone / requiredTotal) * 100)
  const complete = requiredDone === requiredTotal
  const nextStep =
    required.find((s) => !s.done) ?? steps.find((s) => s.optional && !s.done) ?? null

  return { percent, complete, requiredTotal, requiredDone, steps, nextStep, applicable }
})

async function loadTrainer(tenantId: string) {
  const [publishedSessions, publishedCamps, profile] = await Promise.all([
    (prisma as any).trainingSession.count({ where: { tenantId, isPublished: true } }),
    (prisma as any).camp.count({ where: { tenantId, isPublished: true } }),
    (prisma as any).trainerProfile.findUnique({
      where: { tenantId },
      select: { oneOnOneEnabled: true },
    }),
  ])
  return {
    hasProgram: publishedSessions + publishedCamps > 0,
    oneOnOneEnabled: !!profile?.oneOnOneEnabled,
  }
}

async function loadClub(tenantId: string) {
  const [tenant, branding, teams, staff, tryouts, lockedRosters, payConfig] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { stripeAccountId: true } }),
    prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { logoUrl: true, primaryColor: true },
    }),
    prisma.team.count({ where: { tenantId } }),
    prisma.userRole.count({
      where: { role: "Staff", OR: [{ tenantId }, { team: { tenantId } }] },
    }),
    prisma.tryout.count({ where: { tenantId } }),
    prisma.seasonRoster.count({
      where: { isLocked: true, teamSubmission: { team: { tenantId } } },
    }),
    prisma.paymentConfig.findUnique({ where: { tenantId }, select: { stripeAccountId: true } }),
  ])

  return {
    branded:
      !!branding?.logoUrl ||
      (!!branding?.primaryColor && branding.primaryColor !== DEFAULT_PRIMARY_COLOR),
    hasTeam: teams > 0,
    hasStaff: staff > 0,
    hasTryout: tryouts > 0,
    hasLockedRoster: lockedRosters > 0,
    paymentsConnected: !!tenant?.stripeAccountId || !!payConfig?.stripeAccountId,
  }
}

async function loadLeague(userId: string, leagueRoleIds: string[]) {
  // `League.ownerId` is a bare string (no relation), so match owner-by-id OR the
  // role-scoped ids. Latest season leads for the divisions deep link.
  const orClauses: any[] = [{ ownerId: userId }]
  if (leagueRoleIds.length > 0) orClauses.push({ id: { in: leagueRoleIds } })

  const league = await prisma.league.findFirst({
    where: { OR: orClauses },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      seasons: {
        orderBy: { createdAt: "desc" },
        select: { id: true, _count: { select: { divisions: true } } },
      },
    },
  })

  if (!league) {
    return {
      hasLeague: false,
      hasSeason: false,
      hasDivision: false,
      primaryLeagueId: null as string | null,
      primarySeasonId: null as string | null,
    }
  }

  const seasonWithDivisions = league.seasons.find((s) => s._count.divisions > 0)
  return {
    hasLeague: true,
    hasSeason: league.seasons.length > 0,
    hasDivision: !!seasonWithDivisions,
    primaryLeagueId: league.id,
    // Prefer a season that already has divisions; else the latest season.
    primarySeasonId: (seasonWithDivisions ?? league.seasons[0])?.id ?? null,
  }
}

async function loadReferee(userId: string) {
  const [profile, availability] = await Promise.all([
    prisma.refereeProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.refereeAvailability.count({ where: { userId } }),
  ])
  return { hasProfile: !!profile, hasAvailability: availability > 0 }
}

async function loadFamily(userId: string) {
  const [children, offersOrTeams, signups] = await Promise.all([
    prisma.player.count({ where: { parentId: userId, deletedAt: null } }),
    prisma.player.count({
      where: {
        parentId: userId,
        deletedAt: null,
        OR: [{ offers: { some: {} } }, { teams: { some: {} } }],
      },
    }),
    prisma.tryoutSignup.count({ where: { player: { parentId: userId } } }),
  ])
  return { hasChild: children > 0, hasEngagement: offersOrTeams > 0 || signups > 0 }
}
