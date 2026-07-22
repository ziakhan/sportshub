import { prisma } from "@youthbasketballhub/db"

/**
 * Program staff (docs/roadmap/program-staff-plan.md): camps and house
 * leagues get a LEAD + ASSISTANTs. Assignment grants manage-lite — see the
 * program, view registrants/check-in, edit description & schedule — while
 * pricing/publish/delete stay with club admins. Tournaments deferred
 * (league-like; designed with the tournament pass).
 */

export type ProgramType = "CAMP" | "HOUSE_LEAGUE"

export const PROGRAM_TYPE_BY_SLUG: Record<string, ProgramType> = {
  camp: "CAMP",
  "house-league": "HOUSE_LEAGUE",
}

export interface ResolvedProgram {
  programType: ProgramType
  programId: string
  tenantId: string
  title: string
}

export async function resolveProgram(
  programType: ProgramType,
  programId: string
): Promise<ResolvedProgram | null> {
  if (programType === "CAMP") {
    const camp = await (prisma as any).camp.findUnique({
      where: { id: programId },
      select: { id: true, tenantId: true, name: true },
    })
    return camp
      ? { programType, programId, tenantId: camp.tenantId, title: camp.name }
      : null
  }
  const hl = await (prisma as any).houseLeague.findUnique({
    where: { id: programId },
    select: { id: true, tenantId: true, name: true },
  })
  return hl ? { programType, programId, tenantId: hl.tenantId, title: hl.name } : null
}

/** Club admins (or platform admins) manage a program's staff list. */
export async function isClubAdmin(
  userId: string,
  isPlatformAdmin: boolean,
  tenantId: string
): Promise<boolean> {
  if (isPlatformAdmin) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, tenantId, role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any } },
    select: { id: true },
  })
  return !!role
}

/** Is this user assigned to the program (any designation)? */
export async function isAssignedProgramStaff(
  userId: string,
  programType: ProgramType,
  programId: string
): Promise<boolean> {
  const row = await (prisma as any).programStaff.findUnique({
    where: { programType_programId_userId: { programType, programId, userId } },
    select: { id: true },
  })
  return !!row
}

export interface ProgramStaffEntry {
  userId: string
  name: string
  email: string
  designation: "LEAD" | "ASSISTANT"
}

export async function listProgramStaff(
  programType: ProgramType,
  programId: string
): Promise<ProgramStaffEntry[]> {
  const rows = await (prisma as any).programStaff.findMany({
    where: { programType, programId },
    select: {
      userId: true,
      designation: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ designation: "asc" }, { createdAt: "asc" }], // LEAD first
  })
  return rows.map((r: any) => ({
    userId: r.userId,
    name: `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim() || r.user.email,
    email: r.user.email,
    designation: r.designation,
  }))
}

/** All programs a user is assigned to — powers the "My programs" block. */
export async function getMyPrograms(userId: string): Promise<
  Array<{
    programType: ProgramType
    programId: string
    tenantId: string
    title: string
    designation: "LEAD" | "ASSISTANT"
    startDate: Date | null
  }>
> {
  const rows = await (prisma as any).programStaff.findMany({
    where: { userId, programType: { in: ["CAMP", "HOUSE_LEAGUE"] } },
    select: { programType: true, programId: true, designation: true },
  })
  if (rows.length === 0) return []
  const campIds = rows.filter((r: any) => r.programType === "CAMP").map((r: any) => r.programId)
  const hlIds = rows
    .filter((r: any) => r.programType === "HOUSE_LEAGUE")
    .map((r: any) => r.programId)
  const [camps, hls] = await Promise.all([
    campIds.length
      ? (prisma as any).camp.findMany({
          where: { id: { in: campIds } },
          select: { id: true, tenantId: true, name: true, startDate: true },
        })
      : Promise.resolve([]),
    hlIds.length
      ? (prisma as any).houseLeague.findMany({
          where: { id: { in: hlIds } },
          select: { id: true, tenantId: true, name: true, startDate: true },
        })
      : Promise.resolve([]),
  ])
  const campById = new Map(camps.map((c: any) => [c.id, c]))
  const hlById = new Map(hls.map((h: any) => [h.id, h]))
  return rows
    .map((r: any) => {
      const program: any =
        r.programType === "CAMP" ? campById.get(r.programId) : hlById.get(r.programId)
      if (!program) return null
      return {
        programType: r.programType,
        programId: r.programId,
        tenantId: program.tenantId,
        title: program.name,
        designation: r.designation,
        startDate: program.startDate ?? null,
      }
    })
    .filter(Boolean) as any
}

/**
 * Manage-lite field allowlist for assigned staff editing their program —
 * description + schedule only; anything else in the body gets a 403 from
 * the PATCH routes.
 */
export const MANAGE_LITE_FIELDS: Record<ProgramType, ReadonlySet<string>> = {
  CAMP: new Set([
    "description",
    "details",
    "dailyStartTime",
    "dailyEndTime",
    "location",
    "venueId",
    "startDate",
    "endDate",
  ]),
  HOUSE_LEAGUE: new Set([
    "description",
    "details",
    "location",
    "venueId",
    "daysOfWeek",
    "startTime",
    "endTime",
    "startDate",
    "endDate",
  ]),
}
