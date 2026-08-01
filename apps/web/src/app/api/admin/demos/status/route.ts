import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const STATUS_FILE = join(tmpdir(), "sportshub-demo-load.json")
const LOG_FILE = join(tmpdir(), "sportshub-demo-load.log")

/**
 * GET /api/admin/demos/status — the console's 3-second poll: the loader's
 * state file + the seeder log tail + which scenario/stage the WORLD says it
 * holds (PlatformSettings.demoState — survives restarts; the temp file is
 * best-effort).
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth?.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let load: unknown = null
    try {
      load = JSON.parse(readFileSync(STATUS_FILE, "utf8"))
    } catch {
      load = null
    }
    let logTail: string[] = []
    try {
      logTail = readFileSync(LOG_FILE, "utf8").trim().split("\n").slice(-12)
    } catch {
      logTail = []
    }
    const settings = await (prisma as any).platformSettings.findUnique({
      where: { id: "default" },
      select: { demoState: true },
    })
    return NextResponse.json({ load, logTail, world: settings?.demoState ?? null })
  } catch (error) {
    console.error("Demo status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
