import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { spawn } from "child_process"
import { createWriteStream, readFileSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const STATUS_FILE = join(tmpdir(), "sportshub-demo-load.json")
const LOG_FILE = join(tmpdir(), "sportshub-demo-load.log")

const bodySchema = z.object({
  scenario: z.string().min(1),
  stage: z.number().int().min(1).max(9).optional(),
})

interface LoadStatus {
  state: "running" | "done" | "failed"
  scenario: string
  stage?: number
  startedAt: string
  finishedAt?: string
  pid?: number
}

function readStatus(): LoadStatus | null {
  try {
    return JSON.parse(readFileSync(STATUS_FILE, "utf8"))
  } catch {
    return null
  }
}

/**
 * POST /api/admin/demos/load {scenario, stage?} (owner 2026-08-01: "press a
 * button in my admin console and load that demo"). Spawns the seeder
 * DETACHED — self-hosted, no serverless timeout — and tracks state in a
 * temp status file the console polls. Stage > 1 on a staged scenario is a
 * FAST-FORWARD (additive top-up; the seeder itself refuses illegal jumps).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth?.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "scenario required" }, { status: 400 })

    const current = readStatus()
    if (current?.state === "running") {
      return NextResponse.json(
        { error: "A demo load is already running", status: current },
        { status: 409 }
      )
    }

    const { scenario, stage } = parsed.data
    // The app runs from the repo root on box + dev; the seeder resolves its
    // own imports relative to the repo.
    const repoRoot = join(process.cwd(), "..", "..")
    const args = [
      "tsx",
      "scripts/seed-nph-demo.ts",
      `--scenario=${scenario}`,
      ...(stage ? [`--stage=${stage}`] : []),
      "--yes-prod",
    ]
    const log = createWriteStream(LOG_FILE, { flags: "w" })
    const child = spawn("npx", args, {
      cwd: repoRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    })
    child.stdout?.pipe(log)
    child.stderr?.pipe(log)

    const status: LoadStatus = {
      state: "running",
      scenario,
      stage,
      startedAt: new Date().toISOString(),
      pid: child.pid,
    }
    writeFileSync(STATUS_FILE, JSON.stringify(status))

    child.on("exit", (code) => {
      writeFileSync(
        STATUS_FILE,
        JSON.stringify({
          ...status,
          state: code === 0 ? "done" : "failed",
          finishedAt: new Date().toISOString(),
        })
      )
    })
    child.unref()

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error("Demo load error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
