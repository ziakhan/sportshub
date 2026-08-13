import { NextResponse } from "next/server"
import { DEMO_VIEW_COOKIE } from "@/lib/demo/persona-session"

export const dynamic = "force-dynamic"

/** Leave the persona demo: drop the cookie, back to the real account. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(DEMO_VIEW_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" })
  return res
}
