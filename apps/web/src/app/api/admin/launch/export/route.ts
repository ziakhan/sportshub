import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * CSV export of the launch notify list (owner 2026-08-17: "see everybody who
 * signed up and possibly export their stuff"). Admin only.
 */

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export async function GET() {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const signups = await (prisma as any).launchSignup.findMany({
    orderBy: { createdAt: "asc" },
  })

  const lines = ["contact,kind,identity,source,signed_up_at"]
  for (const s of signups) {
    lines.push(
      [
        csvCell(s.contact),
        s.kind,
        csvCell(s.identity ?? ""),
        csvCell(s.source),
        s.createdAt.toISOString(),
      ].join(",")
    )
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="launch-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
