import { prisma } from "@youthbasketballhub/db"

/**
 * Merchant-side authorization for payment actions: the obligation's payee is
 * a club (tenant roles) or a league (league roles / direct owner) — plus the
 * platform admin everywhere.
 */

export interface MerchantScope {
  payeeTenantId: string | null
  payeeLeagueId: string | null
  payeeLeague?: { ownerId: string } | null
}

export async function merchantAccess(
  userId: string,
  scope: MerchantScope,
  opts: { tenantRoles?: string[] } = {}
): Promise<boolean> {
  if (scope.payeeLeague?.ownerId === userId) return true
  // Security fix 2026-07-20: Staff dropped from the default — a one-team
  // coach could record cash/e-transfer payments against ANY family's
  // obligation club-wide. Money handling is admin work.
  const tenantRoles = opts.tenantRoles ?? ["ClubOwner", "ClubManager"]
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        ...(scope.payeeTenantId
          ? [{ tenantId: scope.payeeTenantId, role: { in: tenantRoles as any } }]
          : []),
        ...(scope.payeeLeagueId
          ? [
              {
                leagueId: scope.payeeLeagueId,
                role: { in: ["LeagueOwner", "LeagueManager"] as any },
              },
            ]
          : []),
        { role: "PlatformAdmin" as any },
      ],
    },
  })
  return !!role
}
