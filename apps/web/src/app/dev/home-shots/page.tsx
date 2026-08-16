import fs from "node:fs"
import path from "node:path"

/**
 * Contact sheet for the launch homepage screenshots (owner request,
 * 2026-08-17): every candidate capture from the expedition, framed and
 * labelled, so the owner can pick the set the homepage band will use.
 *
 * Reads apps/web/public/home-preview/shots/ at request time; re-running
 * scripts/demo/capture-home-expedition.mjs refreshes the sheet on reload.
 * Dev-only route, never public in production.
 */

export const dynamic = "force-dynamic"

const GROUPS: { title: string; prefixes: string[] }[] = [
  { title: "The live game", prefixes: ["game-live"] },
  { title: "News and recaps", prefixes: ["news"] },
  { title: "Feed and browse", prefixes: ["home-feed", "leagues-browse"] },
  { title: "League: standings and leaders", prefixes: ["league-"] },
  { title: "Club page", prefixes: ["club-page"] },
  { title: "The parent's phone, signed in", prefixes: ["parent-"] },
  { title: "Social: the feed and a player's page", prefixes: ["social-"] },
]

function readShots(): string[] {
  const dir = path.join(process.cwd(), "public", "home-preview", "shots")
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .sort()
  } catch {
    return []
  }
}

export default function HomeShotsPage() {
  const files = readShots()
  const grouped = GROUPS.map((g) => ({
    title: g.title,
    files: files.filter((f) => g.prefixes.some((p) => f.startsWith(p))),
  }))
  const claimed = new Set(grouped.flatMap((g) => g.files))
  const rest = files.filter((f) => !claimed.has(f))
  if (rest.length) grouped.push({ title: "Everything else", files: rest })

  return (
    <main className="min-h-screen bg-ink-100 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink-950">
          Homepage screenshot contact sheet
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-600">
          {files.length} captures from the running app, signup chrome hidden. Tell me the file
          names you want on the homepage and how you want them arranged.
        </p>

        {grouped.map(
          (group) =>
            group.files.length > 0 && (
              <section key={group.title} className="mt-12">
                <h2 className="text-xl font-bold text-ink-950">{group.title}</h2>
                <div className="mt-4 flex flex-wrap items-start gap-6">
                  {group.files.map((file) => {
                    const phone = file.includes("-phone")
                    return (
                      <figure
                        key={file}
                        className={phone ? "w-[240px]" : "w-full max-w-[560px]"}
                      >
                        <div className="overflow-hidden rounded-xl bg-ink-900 p-1.5 shadow-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/home-preview/shots/${file}`}
                            alt={file.replace(/[-.]/g, " ")}
                            className="w-full rounded-lg"
                          />
                        </div>
                        <figcaption className="mt-1.5 break-all font-mono text-[13px] text-ink-600">
                          {file.replace(".png", "")}
                        </figcaption>
                      </figure>
                    )
                  })}
                </div>
              </section>
            )
        )}
      </div>
    </main>
  )
}
