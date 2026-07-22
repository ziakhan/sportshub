import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { format } from "date-fns"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { notifySafe } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/** GET /api/trainers/[tenantId]/bookings — operator's upcoming 1-on-1 list */
export async function GET(_request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const bookings = await (prisma as any).oneOnOneBooking.findMany({
      where: {
        tenantId: params.tenantId,
        startAt: { gte: new Date(Date.now() - 86_400_000) },
      },
      include: {
        player: { select: { firstName: true, lastName: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { startAt: "asc" },
    })
    return NextResponse.json({
      bookings: bookings.map((b: any) => ({ ...b, fee: Number(b.fee) })),
    })
  } catch (error) {
    console.error("Bookings list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const patchSchema = z.object({
  bookingId: z.string(),
  action: z.literal("cancel"),
})

/**
 * PATCH /api/trainers/[tenantId]/bookings — cancel a booking. Allowed for
 * the trainer (tenant admin) or the parent who booked it; the other side
 * gets notified.
 */
export async function PATCH(request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = patchSchema.parse(body)

    const booking = await (prisma as any).oneOnOneBooking.findFirst({
      where: { id: data.bookingId, tenantId: params.tenantId },
      include: {
        player: { select: { firstName: true, lastName: true } },
        tenant: { select: { name: true } },
      },
    })
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    const isOperator = await isClubAdmin(auth.userId, params.tenantId)
    const isBooker = booking.userId === auth.userId
    if (!isOperator && !isBooker) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ success: true })
    }

    await (prisma as any).oneOnOneBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    })

    const when = format(new Date(booking.startAt), "EEE MMM d, h:mm a")
    const playerName = `${booking.player.firstName} ${booking.player.lastName}`
    if (isOperator && !isBooker) {
      await notifySafe({
        userId: booking.userId,
        type: "registration_confirmed",
        title: "Session cancelled",
        message: `${booking.tenant.name} cancelled ${playerName}'s ${when} session.`,
        link: "/dashboard",
        referenceId: booking.id,
        referenceType: "OneOnOneBooking",
      })
    } else {
      const staff = await prisma.userRole.findMany({
        where: {
          tenantId: params.tenantId,
          role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
        },
        select: { userId: true },
      })
      for (const s of staff) {
        await notifySafe({
          userId: s.userId,
          type: "signup_received",
          title: "Booking cancelled",
          message: `${playerName}'s ${when} session was cancelled by the family.`,
          link: `/clubs/${params.tenantId}/one-on-one`,
          referenceId: booking.id,
          referenceType: "OneOnOneBooking",
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error" }, { status: 400 })
    }
    console.error("Booking cancel error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
