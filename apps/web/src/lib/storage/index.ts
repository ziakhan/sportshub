/**
 * Pluggable upload storage (owner 2026-08-18: "we should have an option to do an
 * S3 or local for now ... so it should be configurable").
 *
 * Before this, images were base64 data URLs in Postgres text columns. That costs
 * 33% in size on top of the file, bloats every TenantBranding row, and ships the
 * whole image inline in the HTML on every single render. Workable for one logo.
 * Hopeless for a sponsor wall or a photo gallery.
 *
 * Two drivers, switchable from the admin console with no deploy:
 *
 *   LOCAL  writes to a directory OUTSIDE the repo and lets Caddy serve it
 *          directly. The box already runs Caddy, and its deploy is a
 *          `git pull --ff-only`, so uploads kept outside the tree survive every
 *          deploy and can never be caught by a `git clean`.
 *   S3     any S3-compatible bucket (real AWS, R2, MinIO, Backblaze) via an
 *          endpoint override.
 *
 * SECURITY POSTURE
 * ----------------
 * 1. Credentials NEVER touch the database. The driver and the bucket's public
 *    shape are admin-editable rows; the access key and secret come from the
 *    process environment only, so a database dump cannot leak them.
 * 2. Content type is decided by INSPECTING THE BYTES, never by trusting the
 *    client's Content-Type or the file extension. Both are attacker-controlled.
 * 3. Only raster image signatures are accepted. No SVG: it is XML, it can carry
 *    script, and it would be served from our own origin.
 * 4. Stored names are random. A caller never controls the path, so traversal and
 *    overwrite of someone else's file are both structurally impossible.
 */

import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@youthbasketballhub/db"

export type UploadDriver = "LOCAL" | "S3"

export interface StorageConfig {
  driver: UploadDriver
  localDir: string
  publicUrl: string
  s3Bucket: string | null
  s3Region: string | null
  s3Endpoint: string | null
  maxBytes: number
}

const DEFAULTS: StorageConfig = {
  driver: "LOCAL",
  localDir: "/var/lib/sportshub/uploads",
  publicUrl: "/uploads",
  s3Bucket: null,
  s3Region: null,
  s3Endpoint: null,
  maxBytes: 8 * 1024 * 1024,
}

export async function getStorageConfig(): Promise<StorageConfig> {
  try {
    const s: any = await (prisma as any).platformSettings.findUnique({ where: { id: "default" } })
    if (!s) return DEFAULTS
    return {
      driver: s.uploadDriver === "S3" ? "S3" : "LOCAL",
      localDir: s.uploadLocalDir || DEFAULTS.localDir,
      publicUrl: (s.uploadPublicUrl || DEFAULTS.publicUrl).replace(/\/+$/, ""),
      s3Bucket: s.uploadS3Bucket || null,
      s3Region: s.uploadS3Region || null,
      s3Endpoint: s.uploadS3Endpoint || null,
      maxBytes: Math.max(1, Number(s.uploadMaxMb) || 8) * 1024 * 1024,
    }
  } catch {
    return DEFAULTS
  }
}

/* ------------------------------------------------------------ type sniffing */

/**
 * Magic-byte signatures. The client's declared type and the filename extension
 * are both attacker-controlled, so neither is consulted.
 */
const SIGNATURES: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: "png", mime: "image/png", test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", mime: "image/gif", test: (b) => b.length > 6 && b.subarray(0, 6).toString("ascii").startsWith("GIF8") },
  { ext: "webp", mime: "image/webp", test: (b) => b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  { ext: "avif", mime: "image/avif", test: (b) => b.length > 12 && b.subarray(4, 8).toString("ascii") === "ftyp" && b.subarray(8, 12).toString("ascii").startsWith("avif") },
]

export interface SniffResult {
  ok: boolean
  ext?: string
  mime?: string
  error?: string
}

export function sniffImage(buf: Buffer, maxBytes: number): SniffResult {
  if (!buf.length) return { ok: false, error: "The file is empty." }
  if (buf.length > maxBytes) {
    return { ok: false, error: `That file is larger than ${Math.round(maxBytes / 1024 / 1024)}MB.` }
  }
  const hit = SIGNATURES.find((s) => s.test(buf))
  if (!hit) {
    // Deliberately explicit about SVG: people try it constantly, and serving
    // attacker-authored XML from our own origin is a cross-site scripting hole.
    return { ok: false, error: "That is not an image we accept. Use a PNG, JPG, WebP, GIF or AVIF. SVG is not allowed." }
  }
  return { ok: true, ext: hit.ext, mime: hit.mime }
}

/* -------------------------------------------------------------------- write */

export interface PutResult {
  /** Public URL to store on the record. */
  url: string
  /** Driver-relative key, for later deletion. */
  key: string
}

/**
 * @param folder  a slug-safe bucket for the caller's own organisation, e.g.
 *                "club-logos". Sanitised regardless: callers never build paths.
 */
export async function putImage(buf: Buffer, folder: string, cfg?: StorageConfig): Promise<PutResult> {
  const c = cfg ?? (await getStorageConfig())
  const sniff = sniffImage(buf, c.maxBytes)
  if (!sniff.ok) throw new Error(sniff.error)

  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "misc"
  // Random name: the caller never influences the path, so traversal and
  // clobbering another club's file are both impossible by construction.
  const key = `${safeFolder}/${randomUUID()}.${sniff.ext}`

  if (c.driver === "S3") {
    if (!c.s3Bucket) throw new Error("S3 is selected but no bucket is configured.")
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
    const client = new S3Client({
      region: c.s3Region || "us-east-1",
      ...(c.s3Endpoint ? { endpoint: c.s3Endpoint, forcePathStyle: true } : {}),
      ...(process.env.UPLOAD_S3_ACCESS_KEY_ID && process.env.UPLOAD_S3_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    })
    await client.send(
      new PutObjectCommand({
        Bucket: c.s3Bucket,
        Key: key,
        Body: buf,
        ContentType: sniff.mime,
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
    return { url: `${c.publicUrl}/${key}`, key }
  }

  const dest = path.join(c.localDir, key)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, buf)
  return { url: `${c.publicUrl}/${key}`, key }
}

export async function deleteImage(key: string, cfg?: StorageConfig): Promise<void> {
  const c = cfg ?? (await getStorageConfig())
  if (!key || key.includes("..")) return
  if (c.driver === "S3") {
    if (!c.s3Bucket) return
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const client = new S3Client({
      region: c.s3Region || "us-east-1",
      ...(c.s3Endpoint ? { endpoint: c.s3Endpoint, forcePathStyle: true } : {}),
    })
    await client.send(new DeleteObjectCommand({ Bucket: c.s3Bucket, Key: key }))
    return
  }
  await fs.rm(path.join(c.localDir, key), { force: true })
}

/** Admin health check: can we actually write with the current settings? */
export async function checkStorage(cfg?: StorageConfig): Promise<{ ok: boolean; detail: string }> {
  const c = cfg ?? (await getStorageConfig())
  if (c.driver === "S3") {
    if (!c.s3Bucket) return { ok: false, detail: "No bucket set." }
    if (!process.env.UPLOAD_S3_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
      return { ok: false, detail: "No credentials in the environment. Set UPLOAD_S3_ACCESS_KEY_ID and UPLOAD_S3_SECRET_ACCESS_KEY on the server." }
    }
    return { ok: true, detail: `Ready to write to ${c.s3Bucket}.` }
  }
  try {
    await fs.mkdir(c.localDir, { recursive: true })
    const probe = path.join(c.localDir, `.probe-${randomUUID()}`)
    await fs.writeFile(probe, "ok")
    await fs.rm(probe, { force: true })
    return { ok: true, detail: `Writable: ${c.localDir}` }
  } catch (e: any) {
    return { ok: false, detail: `Cannot write to ${c.localDir}: ${e?.message ?? "unknown error"}` }
  }
}
