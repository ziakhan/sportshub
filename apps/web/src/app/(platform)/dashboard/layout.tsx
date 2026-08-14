import { requireOnboarded } from "@/lib/onboarding/guard"
import { CourtBackdrop } from "@/components/ui"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // K-005: direct navigation must not bypass onboarding (funnel-only gate
  // let bookmarked/deep-linked visits render a role-less dashboard).
  await requireOnboarded()
  // Court system v2, screen 04: working screens get the quietest tier: a
  // whisper of plank grain under the cards instead of dead white, no court
  // lines and no wash (spec R4).
  return (
    <CourtBackdrop
      variant="daylight"
      intensity="ambient"
      className="min-h-full bg-[#faf8f4]"
      contentClassName="p-6 md:p-8"
    >
      {children}
    </CourtBackdrop>
  )
}
