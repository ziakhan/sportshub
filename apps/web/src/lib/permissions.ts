import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability"

type Actions = "manage" | "create" | "read" | "update" | "delete"
type Subjects =
  | "Club"
  | "Team"
  | "Player"
  | "Tryout"
  | "Offer"
  | "League"
  | "Game"
  | "Payment"
  | "Staff"
  | "Announcement"
  | "all"

export type AppAbility = MongoAbility<[Actions, Subjects]>

interface UserRole {
  role: string
  tenantId?: string | null
  teamId?: string | null
  leagueId?: string | null
  gameId?: string | null
}

/**
 * Define user abilities based on their roles
 */
export function defineAbilitiesFor(userId: string, roles: UserRole[]) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility) as any

  roles.forEach((userRole) => {
    switch (userRole.role) {
      case "PlatformAdmin":
        // Platform admins can do everything
        can("manage", "all")
        break

      case "ClubOwner":
        if (userRole.tenantId) {
          // Full control over tenant resources
          can("manage", "Club", { id: userRole.tenantId })
          can("manage", "Team", { tenantId: userRole.tenantId })
          can("manage", "Tryout", { tenantId: userRole.tenantId })
          can("manage", "Staff", { tenantId: userRole.tenantId })
          can("manage", "Payment", { tenantId: userRole.tenantId })
          can("manage", "Announcement", { tenantId: userRole.tenantId })

          // Can read leagues/games involving their teams
          can("read", "League")
          can("read", "Game")
        }
        break

      case "ClubManager":
        if (userRole.tenantId) {
          // Similar to ClubOwner but cannot delete club
          can("read", "Club", { id: userRole.tenantId })
          can("update", "Club", { id: userRole.tenantId })
          can("manage", "Team", { tenantId: userRole.tenantId })
          can("manage", "Tryout", { tenantId: userRole.tenantId })
          can("manage", "Staff", { tenantId: userRole.tenantId })
          can("read", "Payment", { tenantId: userRole.tenantId })
        }
        break

      case "Staff":
        if (userRole.teamId) {
          // Can manage their team
          can("read", "Team", { id: userRole.teamId })
          can("update", "Team", { id: userRole.teamId })
          can("create", "Offer", { teamId: userRole.teamId })
          can("read", "Player")
          can("read", "Game")
          can("create", "Announcement", { teamId: userRole.teamId })
        }
        break

      case "TeamManager":
        if (userRole.teamId) {
          // Can manage team admin tasks
          can("read", "Team", { id: userRole.teamId })
          can("update", "Team", { id: userRole.teamId })
          can("read", "Player")
          can("read", "Game")
        }
        break

      case "LeagueOwner":
        if (userRole.leagueId) {
          // Full control over league
          can("manage", "League", { id: userRole.leagueId })
          can("manage", "Game", { leagueId: userRole.leagueId })
          can("read", "Team")
        }
        break

      case "LeagueManager":
        if (userRole.leagueId) {
          // League operations
          can("read", "League", { id: userRole.leagueId })
          can("update", "League", { id: userRole.leagueId })
          can("create", "Game", { leagueId: userRole.leagueId })
          can("update", "Game", { leagueId: userRole.leagueId })
        }
        break

      case "Parent":
        // Parents can manage their own players
        can("create", "Player")
        can("read", "Player", { parentId: userId })
        can("update", "Player", { parentId: userId })

        // Can signup for tryouts
        can("read", "Tryout", { isPublished: true, isPublic: true })
        can("create", "Payment")
        can("read", "Payment", { payerId: userId })

        // Can view team/game info if child is on team
        can("read", "Team")
        can("read", "Game")
        break

      case "Player":
        // Players can view their own info
        can("read", "Player", { id: userId })
        can("read", "Team")
        can("read", "Game")
        break

      case "Referee":
        // Referees can view games and update scores
        can("read", "Game")
        can("read", "League")
        break

      case "Scorekeeper":
        if (userRole.gameId) {
          // Can update specific game score
          can("update", "Game", { id: userRole.gameId })
        }
        break
    }
  })

  return build()
}

/**
 * Check if user can perform action on subject
 */
export function canUser(
  ability: AppAbility,
  action: Actions,
  subject: Subjects,
  field?: any
) {
  return ability.can(action, subject, field)
}
