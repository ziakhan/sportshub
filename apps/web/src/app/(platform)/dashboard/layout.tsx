import { requireOnboarded } from "@/lib/onboarding/guard"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // K-005: direct navigation must not bypass onboarding (funnel-only gate
  // let bookmarked/deep-linked visits render a role-less dashboard).
  await requireOnboarded()
  return <div className="p-6 md:p-8">{children}</div>
}
