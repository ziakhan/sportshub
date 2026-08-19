import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getStorageConfig, putImage, sniffImage } from "@/lib/storage"

export const dynamic = "force-dynamic"
// Buffering an 8MB image needs more than the edge default.
export const maxDuration = 30

/**
 * POST /api/uploads — accept one image and return its public URL.
 *
 * Auth is required and scoped: a caller must be a PlatformAdmin, or hold an
 * owner/manager/trainer role on the tenant they name. Anonymous upload to our own
 * origin would be a free file host and, worse, a way to park content we then
 * serve under our domain.
 *
 * The file is accepted on its BYTES, never on its declared type or extension.
 * See lib/storage for the signature table and why SVG is refused.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Send the file as multipart form data." }, { status: 400 })

  const file = form.get("file")
  const folder = String(form.get("folder") ?? "misc")
  const tenantId = form.get("tenantId") ? String(form.get("tenantId")) : null

  const roles = user.roles.map((r: any) => r.role)
  const isPlatformAdmin = roles.includes("PlatformAdmin")
  if (!isPlatformAdmin) {
    if (!tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const ok = user.roles.some(
      (r: any) =>
        r.tenantId === tenantId &&
        (r.role === "ClubOwner" || r.role === "ClubManager" || r.role === "Trainer")
    )
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 })
  }

  const cfg = await getStorageConfig()
  const buf = Buffer.from(await (file as File).arrayBuffer())

  // Sniff before writing, so a rejected file never reaches the disk or bucket.
  const sniff = sniffImage(buf, cfg.maxBytes)
  if (!sniff.ok) return NextResponse.json({ error: sniff.error }, { status: 400 })

  try {
    const { url, key } = await putImage(buf, folder, cfg)
    return NextResponse.json({ url, key, bytes: buf.length, type: sniff.mime })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "The upload could not be stored." },
      { status: 500 }
    )
  }
}
