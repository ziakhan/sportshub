import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { resolveChargeContext, listContextCards } from "@/lib/payments/installments"

export const dynamic = "force-dynamic"

/**
 * GET /api/offers/[id]/payment-info — everything the accept form needs to
 * render the payment step: whether the club takes online money, the currency,
 * each option's payment terms (full / plan + deposit + installment schedule),
 * and the family's cards already on file. Card entry at accept is therefore
 * OPTIONAL — a saved card is used one-click; only a family with no card sees
 * the card field.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const offer = await (prisma as any).offer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        seasonFee: true,
        player: { select: { parentId: true } },
        team: { select: { tenantId: true, tenant: { select: { currency: true } } } },
        options: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            label: true,
            seasonFee: true,
            allowFullPay: true,
            allowInstallments: true,
            depositAmount: true,
            installmentTerms: {
              orderBy: { sequence: "asc" },
              select: { sequence: true, amount: true, dueDate: true, label: true },
            },
          },
        },
      },
    })
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    if (offer.player.parentId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const ctx = await resolveChargeContext(
      { tenantId: offer.team.tenantId },
      offer.team.tenant.currency
    ).catch(() => null)
    const online = !!ctx
    const savedCards = ctx ? await listContextCards(auth.userId, ctx).catch(() => []) : []

    return NextResponse.json({
      online,
      currency: offer.team.tenant.currency,
      seasonFee: Number(offer.seasonFee),
      savedCards,
      options: offer.options.map((o: any) => ({
        id: o.id,
        label: o.label,
        seasonFee: Number(o.seasonFee),
        allowFullPay: o.allowFullPay,
        allowInstallments: o.allowInstallments,
        depositAmount: o.depositAmount != null ? Number(o.depositAmount) : null,
        installmentTerms: o.installmentTerms.map((t: any) => ({
          sequence: t.sequence,
          amount: Number(t.amount),
          dueDate: t.dueDate,
          label: t.label,
        })),
      })),
    })
  } catch (error) {
    console.error("Offer payment-info error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
