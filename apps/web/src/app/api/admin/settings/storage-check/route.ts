import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { checkStorage, getStorageConfig } from "@/lib/storage"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/settings/storage-check
 *
 * Answers the only question that matters after changing the driver: can we
 * actually write right now? A settings form that saves happily and then fails on
 * the first real upload is worse than no form, so the admin gets to prove it
 * before a club discovers it.
 *
 * LOCAL writes and removes a probe file, which catches the common cases: the
 * directory does not exist, or the service user cannot write to it.
 * S3 reports whether a bucket is named and whether credentials are present in
 * the environment, without ever returning their values.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: "PlatformAdmin" },
  })
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const cfg = await getStorageConfig()
  const result = await checkStorage(cfg)

  return NextResponse.json({
    ...result,
    driver: cfg.driver,
    maxMb: Math.round(cfg.maxBytes / 1024 / 1024),
    // Presence only. The values themselves are never returned.
    hasEnvCredentials: !!(
      process.env.UPLOAD_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
    ),
  })
}
