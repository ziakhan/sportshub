import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { profileDataSchema } from "@/lib/validations/onboarding"

const onboardingSchema = z.object({
  roles: z
    .array(z.enum(["Parent", "ClubOwner", "Staff", "Referee", "LeagueOwner", "Player"]))
    .min(1, "Select at least one role"),
  profileData: profileDataSchema.optional(),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const { roles, profileData } = onboardingSchema.parse(body)

    // Find user in database
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Determine which roles need to be created
    const existingRoles = new Set(user.roles.map((r) => r.role))
    const rolesToCreate = roles.filter((r) => !existingRoles.has(r))

    // Create missing roles (all unscoped — scoped when creating club/league/team)
    if (rolesToCreate.length > 0) {
      await prisma.userRole.createMany({
        data: rolesToCreate.map((role) => ({
          userId: user!.id,
          role: role as any,
        })),
        skipDuplicates: true,
      })
    }

    // Process profile data based on role type
    if (profileData) {
      switch (profileData.type) {
        case "Parent":
          await prisma.user.update({
            where: { id: user.id },
            data: {
              phoneNumber: profileData.phoneNumber,
              country: profileData.country || "CA",
              city: profileData.city,
              state: profileData.state,
            },
          })
          break

        case "Staff":
          await prisma.user.update({
            where: { id: user.id },
            data: {
              phoneNumber: profileData.phoneNumber,
              country: profileData.country || "CA",
              city: profileData.city,
              state: profileData.state,
            },
          })
          break

        case "Player": {
          const dob = new Date(profileData.dateOfBirth)
          // Save city/state/country to user record
          await prisma.user.update({
            where: { id: user.id },
            data: {
              country: profileData.country || "CA",
              city: profileData.city,
              state: profileData.state,
            },
          })
          await prisma.player.create({
            data: {
              firstName: user.firstName || "Player",
              lastName: user.lastName || "",
              dateOfBirth: dob,
              gender: profileData.gender as any,
              jerseyNumber: profileData.jerseyNumber || null,
              height: profileData.height || null,
              position: profileData.position || null,
              parentId: user.id,
              isMinor: false,
              canLogin: true,
            },
          })
          break
        }

        case "Referee":
          await prisma.refereeProfile.create({
            data: {
              userId: user.id,
              certificationLevel: profileData.certificationLevel,
              standardFee: profileData.standardFee,
              availableRegions: profileData.availableRegions
                .split(",")
                .map((r) => r.trim())
                .filter(Boolean),
            },
          })
          break

        case "LeagueOwner": {
          const league = await prisma.league.create({
            data: {
              name: profileData.name,
              season: profileData.season,
              description: profileData.description || null,
              ownerId: user.id,
            },
          })

          // Scope the LeagueOwner role to this league
          await prisma.userRole.updateMany({
            where: {
              userId: user.id,
              role: "LeagueOwner",
              leagueId: null,
            },
            data: { leagueId: league.id },
          })
          break
        }
      }
    }

    // Mark user as onboarded
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardedAt: new Date() },
    })

    // Determine next step based on selected roles
    let nextStep = "/"
    if (roles.includes("ClubOwner")) {
      nextStep = "/clubs/find"
    } else if (roles.includes("LeagueOwner")) {
      nextStep = "/dashboard"
    }

    return NextResponse.json({
      success: true,
      roles,
      nextStep,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: String(error) },
      { status: 500 }
    )
  }
}
