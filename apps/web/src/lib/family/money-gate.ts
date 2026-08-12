import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"
import { sendEmail, appBaseUrl, escapeHtml, transactionalFooter, formatMoney } from "@/lib/email"
import { getFamilyAccountContext, type FamilyAccountContext } from "./account-context"

/**
 * The money gate (owner ruling 2026-08-12, structural).
 *
 * A 13-17 self-owned account NEVER sees a payment form. Not "sees a warning",
 * not "sees a card form that checks the name on the card" — the payable
 * action itself changes shape:
 *
 *  - guardian linked → the action becomes a REQUEST. The parent gets a
 *    notification and an email with a deep link to the exact payable thing,
 *    and the kid is told it went to their parent.
 *  - no guardian → the kid is walked into the guardian invite. Nothing to
 *    approve until somebody is there to approve it.
 *
 * 18+ (birth year) pays normally. Parents' own flows never touch this.
 */

export const MINOR_ROUTED_MESSAGE = "Sent to your parent to approve and pay."
export const MINOR_NEEDS_GUARDIAN_MESSAGE =
  "Your parent or guardian needs to approve and pay this. Add them to continue."

export interface MoneyGateRequest {
  /** Signed-in user attempting the payable action. */
  userId: string
  /** Plain-words name of the thing being paid for, for the parent's inbox. */
  what: string
  /** In-app path the parent lands on to approve and pay. */
  deepLink: string
  /** Amount owed, when known — the parent should see the number up front. */
  amount?: number | null
  currency?: string
  /** Reuse an already-loaded context instead of a second query. */
  context?: FamilyAccountContext
}

export type MoneyGateResult =
  | { allowed: true; context: FamilyAccountContext }
  | { allowed: false; response: NextResponse; context: FamilyAccountContext }

/**
 * Gate a payable action. Returns `allowed: true` for adults, for parents, and
 * for anyone without a self-owned player profile; otherwise returns the exact
 * response the route should send back, having already told the parent.
 */
export async function gateMinorPayment(req: MoneyGateRequest): Promise<MoneyGateResult> {
  const context = req.context ?? (await getFamilyAccountContext(req.userId))

  // Adults, parents, operators: nothing changes for them.
  if (!context.player || !context.isMinor) return { allowed: true, context }

  if (!context.hasLinkedParent || !context.parentUserId) {
    return {
      allowed: false,
      context,
      response: NextResponse.json(
        {
          error: MINOR_NEEDS_GUARDIAN_MESSAGE,
          code: "NEEDS_GUARDIAN",
          needsGuardian: true,
          playerId: context.player.id,
        },
        { status: 409 }
      ),
    }
  }

  const parent = await prisma.user.findUnique({
    where: { id: context.parentUserId },
    select: { id: true, email: true, firstName: true },
  })
  const kidName = context.player.firstName
  const link = req.deepLink.startsWith("/") ? req.deepLink : `/${req.deepLink}`
  const money =
    req.amount != null && req.amount > 0 ? ` (${formatMoney(req.amount, req.currency ?? "CAD")})` : ""

  await notifySafe({
    userId: context.parentUserId,
    type: "payment_approval_request",
    title: `${kidName} needs you to approve a payment`,
    message: `${kidName} asked to join ${req.what}${money}. Open it to approve and pay.`,
    link,
    referenceId: context.player.id,
    referenceType: "Player",
  })

  if (parent?.email) {
    try {
      await sendEmail({
        to: parent.email,
        subject: `${kidName} needs your approval for ${req.what}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${escapeHtml(kidName)} needs your approval</h2>
            <p>
              ${escapeHtml(kidName)} asked to join <strong>${escapeHtml(req.what)}</strong>${escapeHtml(money)}
              on SportsHub. Because they are under 18, the payment comes to you.
            </p>
            <p>
              <a href="${appBaseUrl()}${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                Review and pay
              </a>
            </p>
            <p style="color: #666; font-size: 13px;">Nothing is charged until you complete the payment yourself.</p>
            ${transactionalFooter("SportsHub One")}
          </div>
        `,
      })
    } catch (err) {
      console.error("Minor payment approval email failed:", err)
    }
  }

  return {
    allowed: false,
    context,
    response: NextResponse.json(
      {
        routedToParent: true,
        message: MINOR_ROUTED_MESSAGE,
        parentFirstName: parent?.firstName ?? null,
      },
      { status: 202 }
    ),
  }
}
