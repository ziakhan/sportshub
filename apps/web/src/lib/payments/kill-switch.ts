import { prisma } from "@youthbasketballhub/db"

/**
 * The universal payments kill switch (owner ask 2026-08-21).
 *
 * One flag, `PlatformSettings.paymentsEnabled`, gates every path that starts
 * NEW money movement: obligation checkout, offer deposits, offline recording,
 * refunds, and Stripe Connect onboarding. When it is off, those routes answer
 * 503 with a calm message and the installment cron skips its run entirely.
 * Existing money and existing rows are never touched — this only stops new
 * charges and new onboarding from beginning.
 *
 * Fails OPEN: a missing settings row (fresh platform) means payments are on,
 * matching the column default. Only an explicit `false` disables.
 */
export class PaymentsDisabledError extends Error {
  code = "PAYMENTS_DISABLED" as const
  constructor() {
    super("Payments are paused right now. No charge was made, please try again shortly.")
  }
}

/** True when new charges and onboarding are permitted platform-wide. */
export async function paymentsEnabled(): Promise<boolean> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "default" },
    select: { paymentsEnabled: true },
  })
  // Only an explicit false disables; a missing row is a fresh platform (on).
  return settings?.paymentsEnabled !== false
}

/** Throw PaymentsDisabledError when the kill switch is off. */
export async function assertPaymentsEnabled(): Promise<void> {
  if (!(await paymentsEnabled())) throw new PaymentsDisabledError()
}
