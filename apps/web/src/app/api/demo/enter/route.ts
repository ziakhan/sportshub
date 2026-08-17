import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isDemoModeEnabled } from "@/lib/demo/demo-mode"
import {
  DEMO_VIEW_COOKIE,
  PERSONA_EMAILS,
  PUBLIC_PERSONAS,
  encodeDemoView,
  newDemoViewPayload,
  type PersonaKey,
} from "@/lib/demo/persona-session"

export const dynamic = "force-dynamic"

/**
 * Enter the persona demo. Owner ruling (2026-08-12): a REAL signed-in
 * account is required — signup is the gate. The persona is a seeded demo
 * user; reads flow as them while the demo-view cookie lives.
 */
export async function POST(req: Request) {
  if (!(await isDemoModeEnabled())) {
    return NextResponse.json({ error: "The demo is not available right now." }, { status: 404 })
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "Create a free account to try the demo.", signupRequired: true },
      { status: 401 }
    )
  }

  let persona: PersonaKey = "parent"
  try {
    const body = await req.json()
    if (body?.persona && PUBLIC_PERSONAS.includes(body.persona)) persona = body.persona
  } catch {
    // No/invalid body — default persona.
  }

  const personaUser = await prisma.user.findUnique({
    where: { email: PERSONA_EMAILS[persona] },
    select: { id: true, firstName: true },
  })
  if (!personaUser) {
    return NextResponse.json(
      { error: "The demo world is being rebuilt. Try again in a minute." },
      { status: 503 }
    )
  }

  const payload = newDemoViewPayload(personaUser.id, persona)
  const res = NextResponse.json({
    ok: true,
    persona,
    personaName: personaUser.firstName,
    // Landing per persona: the staged first screen (world spec §5).
    landing: persona === "club" ? "/dashboard" : persona === "coach" ? "/dashboard" : "/dashboard",
  })
  res.cookies.set(DEMO_VIEW_COOKIE, encodeDemoView(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  })
  // Client-readable mirror so client components (chat dock) can branch to
  // the overlay endpoints. Carries no authority — the signed cookie does.
  res.cookies.set("demo-view-hint", persona, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  })
  return res
}
