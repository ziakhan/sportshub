/**
 * coverage-audit.ts — deterministic "what exists" enumerator for the platform
 * coverage audit (docs/coverage-audit.md). Prints the raw surface inventory the
 * audit is built on: personas, API routes, pages, data models, integration
 * touchpoints, and hidden/unfinished markers.
 *
 * This is the auto-refreshing half of tracking (see the memory note
 * "coverage-audit-tracking"): re-run it to see what the code actually exposes;
 * the judged classification (done/partial/missing per persona) is layered on
 * top in docs/coverage-audit.md.
 *
 *   Run:  npx tsx scripts/coverage-audit.ts
 *         npx tsx scripts/coverage-audit.ts --json   # machine-readable
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(__dirname, "..")
const APP = join(ROOT, "apps/web/src/app")
const SRC = join(ROOT, "apps/web/src")
const SCHEMA = join(ROOT, "prisma/schema.prisma")

function walk(dir: string, pred: (p: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue
      out.push(...walk(p, pred))
    } else if (pred(p)) out.push(p)
  }
  return out
}

// Strip Next.js route groups "(x)" and turn a file dir into a URL path.
const toRoute = (fileDir: string, base: string) =>
  "/" +
  relative(base, fileDir)
    .split("/")
    .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")))
    .join("/")

// ---- API routes ----
const apiFiles = walk(join(APP, "api"), (p) => p.endsWith("route.ts"))
const apiRoutes = apiFiles
  .map((f) => {
    const src = readFileSync(f, "utf8")
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
      new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src)
    )
    return { path: toRoute(f.replace(/\/route\.ts$/, ""), APP), methods }
  })
  .sort((a, b) => a.path.localeCompare(b.path))

// ---- Pages ----
const pageFiles = walk(APP, (p) => p.endsWith("page.tsx") && !p.includes("/api/"))
const pages = pageFiles
  .map((f) => toRoute(f.replace(/\/page\.tsx$/, ""), APP) || "/")
  .sort()

// ---- Prisma models + Role enum ----
const schema = readFileSync(SCHEMA, "utf8")
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]).sort()
const roleBlock = schema.match(/enum\s+Role\s*\{([^}]*)\}/)
const roles = roleBlock ? roleBlock[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//")) : []

// ---- Integration touchpoints ----
const codeFiles = walk(SRC, (p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".d.ts"))
const INTEGRATIONS: Record<string, RegExp> = {
  stripe: /\bstripe\b|SetupIntent|PaymentIntent|stripeAccountId/i,
  email: /nodemailer|createTransport|sendMail|\bsmtp\b|mailpit/i,
  "google-places": /google.{0,25}places|placeId|AutocompleteService/i,
  ical: /calendarToken|\.ics\b|iCalendar|VCALENDAR/i,
  "media-embed": /youtube|VIDEO_EMBED|MediaAsset/i,
  "ai-recaps": /@anthropic-ai|\banthropic\b|\bclaude\b/i,
  "web-push": /web-push|webpush|PushSubscription/i,
  sms: /\btwilio\b|\bsms\b/i,
}
const integrations = Object.fromEntries(
  Object.entries(INTEGRATIONS).map(([name, re]) => {
    const hits = codeFiles.filter((f) => re.test(readFileSync(f, "utf8")))
    return [name, { files: hits.length, sample: hits.slice(0, 3).map((f) => relative(ROOT, f)) }]
  })
)

// ---- Hidden / unfinished markers ----
const hidden: string[] = []
const todos: string[] = []
for (const f of codeFiles) {
  const lines = readFileSync(f, "utf8").split("\n")
  lines.forEach((ln, i) => {
    if (/\{\s*false\s*&&/.test(ln) || /coming soon/i.test(ln))
      hidden.push(`${relative(ROOT, f)}:${i + 1}  ${ln.trim().slice(0, 80)}`)
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(ln)) todos.push(`${relative(ROOT, f)}:${i + 1}`)
  })
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ roles, apiRoutes, pages, models, integrations, hidden, todos: todos.length }, null, 2))
} else {
  const nsCounts = new Map<string, number>()
  for (const r of apiRoutes) {
    const ns = r.path.split("/")[2] || "(root)"
    nsCounts.set(ns, (nsCounts.get(ns) || 0) + 1)
  }
  console.log(`# Coverage inventory (generated)\n`)
  console.log(`Personas (Role enum, ${roles.length}): ${roles.join(", ")}\n`)
  console.log(`## Surface`)
  console.log(`- API route handlers: ${apiRoutes.length}`)
  console.log(`- Pages: ${pages.length}`)
  console.log(`- Prisma models: ${models.length}\n`)
  console.log(`### API routes by namespace`)
  for (const [ns, n] of [...nsCounts].sort((a, b) => b[1] - a[1])) console.log(`- /api/${ns}: ${n}`)
  console.log(`\n## Integrations`)
  for (const [name, v] of Object.entries(integrations))
    console.log(`- ${name}: ${(v as any).files} files ${(v as any).files ? `(e.g. ${(v as any).sample.join(", ")})` : "— ABSENT"}`)
  console.log(`\n## Hidden / "coming soon" markers (${hidden.length})`)
  hidden.slice(0, 25).forEach((h) => console.log(`- ${h}`))
  console.log(`\n## TODO/FIXME markers: ${todos.length}`)
  console.log(`\n## Data models (${models.length})\n${models.join(", ")}`)
}
