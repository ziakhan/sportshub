import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { OPERATOR_ROLES } from "@/lib/queries/nav"

export const dynamic = "force-dynamic"

/**
 * Role-aware post-login landing (site-ia-plan §8): operators (club/league
 * staff, referees, admins) land in the MANAGE world; parents, players and
 * role-less accounts land on the personalized PUBLIC homepage. Sign-in only
 * defaults here — an explicit callbackUrl (deep link) always wins upstream.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.redirect(new URL("/sign-in", request.url))

  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  })
  const isOperator = roles.some((r: any) => OPERATOR_ROLES.has(r.role))
  return NextResponse.redirect(new URL(isOperator ? "/dashboard" : "/", request.url))
}
