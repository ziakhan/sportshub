import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { generateOneOnOneSlots } from "@/lib/training"

export const dynamic = "force-dynamic"

/**
 * GET /api/trainers/[tenantId]/slots — PUBLIC. The trainer's bookable
 * 1-on-1 slots for the next `days` (default 21, max 60): availability
 * windows sliced into slotMinutes lengths, minus confirmed bookings.
 * Returns only times — never who booked the taken ones.
 */
export async function GET(request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const profile = await (prisma as any).trainerProfile.findUnique({
      where: { tenantId: params.tenantId },
      select: { oneOnOneEnabled: true, oneOnOneTitle: true, oneOnOneFee: true, slotMinutes: true },
    })
    if (!profile?.oneOnOneEnabled) {
      return NextResponse.json({ enabled: false, slots: [] })
    }

    const days = Math.min(60, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 21))
    const now = new Date()
    const horizon = new Date(now.getTime() + days * 86_400_000)

    const [windows, bookings] = await Promise.all([
      (prisma as any).trainerAvailability.findMany({
        where: {
          tenantId: params.tenantId,
          date: { gte: new Date(now.getTime() - 86_400_000), lte: horizon },
        },
        select: { date: true, startTime: true, endTime: true },
      }),
      (prisma as any).oneOnOneBooking.findMany({
        where: {
          tenantId: params.tenantId,
          status: "CONFIRMED",
          startAt: { gte: now, lte: horizon },
        },
        select: { startAt: true },
      }),
    ])

    const slots = generateOneOnOneSlots({
      windows,
      slotMinutes: profile.slotMinutes,
      bookedStartMillis: new Set(bookings.map((b: any) => new Date(b.startAt).getTime())),
      from: now,
    })

    return NextResponse.json({
      enabled: true,
      title: profile.oneOnOneTitle,
      fee: profile.oneOnOneFee != null ? Number(profile.oneOnOneFee) : null,
      slotMinutes: profile.slotMinutes,
      slots: slots.map((s) => s.toISOString()),
    })
  } catch (error) {
    console.error("Trainer slots error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
