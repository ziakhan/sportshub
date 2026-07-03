import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

/**
 * Centralized API route wrapper + authorization helpers.
 *
 * Replaces the former CASL layer (which was defined but enforced nowhere) and
 * the ~50 hand-rolled inline `userRole.findFirst` checks. New/refactored
 * routes wrap handlers in `withAuth` and call `requireTenantRole` /
 * `requirePlatformAdmin` for scope checks, so the authorization surface is
 * auditable in one file.
 *
 * Standard error envelope: `{ error: string, code?: string, details?: any }`.
 */

export interface SessionInfo {
  userId: string
  /** Real signed-in account — differs from userId during impersonation. */
  realUserId: string
  isPlatformAdmin: boolean
}

type RouteContext = { params?: Record<string, string> }

type AuthedHandler<R extends Request, C extends RouteContext> = (
  request: R,
  context: C,
  session: SessionInfo
) => Promise<NextResponse>

/** Standard error response. Every 4xx/5xx should go through this. */
export function apiError(
  status: number,
  error: string,
  code?: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error, ...(code ? { code } : {}), ...(details !== undefined ? { details } : {}) },
    { status }
  )
}

/** Thrown by require* helpers; converted to a response by withAuth. */
export class ApiAuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string
  ) {
    super(message)
  }
}

/**
 * Wrap a route handler with session resolution + uniform error handling.
 * The session is impersonation-aware (getSessionUserId).
 */
export function withAuth<R extends Request = Request, C extends RouteContext = RouteContext>(
  handler: AuthedHandler<R, C>
) {
  return async (request: R, context: C): Promise<NextResponse> => {
    try {
      const session = await getSessionUserId()
      if (!session) {
        return apiError(401, "Unauthorized", "UNAUTHENTICATED")
      }
      return await handler(request, context, session)
    } catch (error) {
      if (error instanceof ApiAuthError) {
        return apiError(error.status, error.message, error.code)
      }
      if (error instanceof z.ZodError) {
        return apiError(400, "Invalid input", "VALIDATION", error.errors)
      }
      console.error("API error:", request.method, new URL(request.url).pathname, error)
      return apiError(500, "Internal server error", "INTERNAL")
    }
  }
}

/** Assert the caller is a PlatformAdmin. */
export function requirePlatformAdmin(session: SessionInfo): void {
  if (!session.isPlatformAdmin) {
    throw new ApiAuthError(403, "Forbidden", "FORBIDDEN")
  }
}

/**
 * Assert the caller holds one of `roles` scoped to `tenantId` (PlatformAdmin
 * always passes). This is the canonical tenant-authorization check.
 */
export async function requireTenantRole(
  session: SessionInfo,
  tenantId: string,
  roles: string[] = ["ClubOwner", "ClubManager"]
): Promise<void> {
  if (session.isPlatformAdmin) return
  const has = await prisma.userRole.findFirst({
    where: { userId: session.userId, tenantId, role: { in: roles as any } },
    select: { id: true },
  })
  if (!has) {
    throw new ApiAuthError(403, "Forbidden", "FORBIDDEN")
  }
}

/**
 * Assert the caller owns the league that owns this season (or is admin).
 * Returns the season's leagueId/ownerId context for further use.
 */
export async function requireSeasonOwner(
  session: SessionInfo,
  seasonId: string
): Promise<{ leagueId: string }> {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { leagueId: true, league: { select: { ownerId: true } } },
  })
  if (!season) {
    throw new ApiAuthError(404, "Season not found", "NOT_FOUND")
  }
  if (!session.isPlatformAdmin && season.league.ownerId !== session.userId) {
    throw new ApiAuthError(403, "Forbidden", "FORBIDDEN")
  }
  return { leagueId: season.leagueId }
}
