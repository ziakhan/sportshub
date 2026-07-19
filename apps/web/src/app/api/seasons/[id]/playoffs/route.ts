import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { getSeasonStandings } from "@/lib/queries/standings"
import { playoffOptionsFor } from "@/lib/playoffs/formats"
import { generatePlayoffs, deletePlayoffs } from "@/lib/playoffs/generate"

export const dynamic = "force-dynamic"

/**
 * Playoff generation (owner 2026-07-18): guided flow — the league owner says
 * how many teams qualify and we offer only the formats that make sense.
 */

async function authorize(seasonId: string) {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return { status: 401 as const, error: "Unauthorized" }
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true, league: { select: { ownerId: true } } },
  })
  if (!season) return { status: 404 as const, error: "Not found" }
  if (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin) {
    return { status: 403 as const, error: "Forbidden" }
  }
  return { status: 200 as const, season }
}

/**
 * GET /api/seasons/[id]/playoffs
 *  - always returns existing playoff brackets for the season
 *  - with ?divisionId=&qualifying= also returns the guided format options +
 *    the seed preview from current standings
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const sessions = await (prisma as any).seasonSession.findMany({
      where: { seasonId: params.id, phase: "PLAYOFF" },
      select: {
        id: true,
        label: true,
        playoffPlan: true,
        games: {
          select: {
            id: true,
            playoffRound: true,
            playoffSlot: true,
            status: true,
            scheduledAt: true,
            homeScore: true,
            awayScore: true,
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
          },
          orderBy: [{ playoffRound: "asc" }, { playoffSlot: "asc" }],
        },
      },
    })

    const url = new URL(request.url)
    const divisionId = url.searchParams.get("divisionId")
    const qualifying = parseInt(url.searchParams.get("qualifying") ?? "", 10)

    let options = null
    let seedPreview = null
    if (divisionId && Number.isFinite(qualifying)) {
      const standings = await getSeasonStandings(params.id)
      const division = standings?.divisions.find((d) => d.divisionId === divisionId)
      if (division) {
        options = playoffOptionsFor(division.rows.length, qualifying)
        seedPreview = division.rows.slice(0, qualifying).map((row, i) => ({
          seed: i + 1,
          teamId: row.teamId,
          name: row.name,
          record: `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}`,
        }))
      }
    }

    return NextResponse.json({ brackets: sessions, options, seedPreview })
  } catch (error) {
    console.error("Playoffs GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const generateSchema = z.object({
  divisionId: z.string().min(1),
  qualifying: z.number().int().min(2).max(64),
  format: z.enum([
    "SINGLE_ELIM",
    "SINGLE_ELIM_THIRD",
    "PLAY_IN_ELIM",
    "ROUND_ROBIN",
    "POOLS_CROSSOVER",
    "ELIM_CONSOLATION",
  ]),
  startDate: z.string().min(4),
})

/** POST /api/seasons/[id]/playoffs — generate a bracket for a division. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    // Playoffs come after a season is actually underway
    if (!["IN_PROGRESS", "COMPLETED"].includes(auth.season.status)) {
      return NextResponse.json(
        { error: "Playoffs can only be generated once the season is in progress" },
        { status: 400 }
      )
    }

    const parsed = generateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const result = await generatePlayoffs({ seasonId: params.id, ...parsed.data })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "NOT_FOUND" ? 404 : 409 }
      )
    }
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Playoffs POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/seasons/[id]/playoffs?sessionId= — scrap an unplayed bracket. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const sessionId = new URL(request.url).searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }
    const session = await (prisma as any).seasonSession.findFirst({
      where: { id: sessionId, seasonId: params.id, phase: "PLAYOFF" },
      select: { id: true },
    })
    if (!session) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 })
    }
    const result = await deletePlayoffs(sessionId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Playoffs DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
