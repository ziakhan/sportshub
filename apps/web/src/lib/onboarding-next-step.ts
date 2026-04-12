export const onboardingRoleEnum = [
  "Parent",
  "ClubOwner",
  "Staff",
  "Referee",
  "LeagueOwner",
  "Player",
] as const

export type OnboardingRole = (typeof onboardingRoleEnum)[number]

export function getOnboardingNextStep(roles: OnboardingRole[]) {
  if (roles.includes("ClubOwner")) {
    return "/clubs/create"
  }

  if (roles.includes("LeagueOwner")) {
    return "/dashboard"
  }

  return "/"
}
