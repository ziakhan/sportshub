import Link from "next/link"
import { format } from "date-fns"
import { Card, StarRating } from "@/components/ui"
import { formatCurrency } from "@/lib/countries"
import { ReviewForm } from "./review-form"

export interface ClubPageData {
  club: any
  currency: string
  accent: string
  teams: any[]
  tryouts: any[]
  houseLeagues: any[]
  camps: any[]
  reviews: any[]
  averageRating: number | null
  totalReviews: number
  signedIn: boolean
  alreadyReviewed: boolean
  staffCount: number
  announcements: any[]
  recentGames: any[]
  upcomingGames: any[]
  news: any[]
}

type Variant = "main" | "rail"

const H2 = "text-ink-950 mb-4 text-lg font-bold"
const railTitle = "text-ink-950 mb-3 font-bold"

export function hasBlockContent(key: string, d: ClubPageData): boolean {
  switch (key) {
    case "about":
      return !!d.club.description
    case "announcements":
      return d.announcements.length > 0
    case "programs":
      return d.tryouts.length + d.houseLeagues.length + d.camps.length > 0
    case "teams":
      return true // shows an empty state
    case "schedule":
      return d.recentGames.length + d.upcomingGames.length > 0
    case "news":
      return d.news.length > 0
    case "reviews":
      return true
    case "nextgame":
      return d.upcomingGames.length > 0
    case "contact":
      return !!(d.club.address || d.club.phoneNumber || d.club.contactEmail || d.club.website)
    case "stats":
      return true
    case "socials":
      return socialLinks(d.club.branding?.socials).length > 0
    default:
      return false
  }
}

/** Anchor id for sub-nav scroll targets (only some blocks have them). */
export const BLOCK_ANCHORS: Record<string, string> = {
  about: "about",
  teams: "teams",
  programs: "programs",
  schedule: "schedule",
  contact: "contact",
}

export function ClubBlock({
  blockKey,
  variant,
  data,
}: {
  blockKey: string
  variant: Variant
  data: ClubPageData
}) {
  const anchor = BLOCK_ANCHORS[blockKey]
  const inner = renderBlock(blockKey, variant, data)
  if (!inner) return null
  return (
    <section id={anchor} className={anchor ? "scroll-mt-24" : undefined}>
      {inner}
    </section>
  )
}

function renderBlock(key: string, variant: Variant, d: ClubPageData) {
  switch (key) {
    case "about":
      return d.club.description ? (
        <Card>
          <h2 className={H2}>About</h2>
          <p className="text-ink-700 whitespace-pre-line">{d.club.description}</p>
        </Card>
      ) : null
    case "announcements":
      return <AnnouncementsBlock d={d} variant={variant} />
    case "programs":
      return <ProgramsBlock d={d} />
    case "teams":
      return <TeamsBlock d={d} />
    case "schedule":
      return <ScheduleBlock d={d} />
    case "news":
      return <NewsBlock d={d} />
    case "reviews":
      return <ReviewsBlock d={d} />
    case "nextgame":
      return <NextGameBlock d={d} variant={variant} />
    case "contact":
      return <ContactBlock d={d} variant={variant} />
    case "stats":
      return <StatsBlock d={d} />
    case "socials":
      return <SocialsBlock d={d} />
    default:
      return null
  }
}

function AnnouncementsBlock({ d, variant }: { d: ClubPageData; variant: Variant }) {
  if (d.announcements.length === 0) return null
  const items = variant === "rail" ? d.announcements.slice(0, 4) : d.announcements
  return (
    <Card>
      <h2 className={variant === "rail" ? railTitle : H2}>Announcements</h2>
      <div className="space-y-3">
        {items.map((a: any) => (
          <div key={a.id} className="border-ink-100 rounded-2xl border p-4">
            <div className="flex items-start gap-2">
              {a.isPinned && (
                <span className="bg-hoop-50 text-hoop-700 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                  Pinned
                </span>
              )}
              <div className="min-w-0">
                <h3 className="text-ink-900 text-sm font-semibold">{a.title}</h3>
                <p className="text-ink-600 mt-1 whitespace-pre-line text-sm">{a.content}</p>
                <p className="text-ink-400 mt-1 text-xs">
                  {format(new Date(a.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ProgramsBlock({ d }: { d: ClubPageData }) {
  if (d.tryouts.length + d.houseLeagues.length + d.camps.length === 0) return null
  return (
    <Card>
      <h2 className={H2}>Open programs</h2>
      <div className="space-y-3">
        {d.tryouts.map((t: any) => (
          <ProgramRow
            key={`t-${t.id}`}
            href={`/tryout/${t.id}`}
            title={t.title}
            tag="Tryout"
            meta={`${format(new Date(t.scheduledAt), "MMM d, yyyy")} • ${t.location}`}
            price={t.fee === 0 ? "FREE" : formatCurrency(t.fee, d.currency)}
          />
        ))}
        {d.houseLeagues.map((l: any) => (
          <ProgramRow
            key={`h-${l.id}`}
            href={`/house-league/${l.id}`}
            title={l.name}
            tag="House league"
            meta={`${l.ageGroups}${l.season ? ` • ${l.season}` : ""} • ${l.location}`}
            price={l.fee === 0 ? "FREE" : formatCurrency(l.fee, d.currency)}
          />
        ))}
        {d.camps.map((c: any) => (
          <ProgramRow
            key={`c-${c.id}`}
            href={`/camp/${c.id}`}
            title={c.name}
            tag="Camp"
            meta={`${c.ageGroup} • ${c.numberOfWeeks} week${c.numberOfWeeks !== 1 ? "s" : ""} • ${c.location}`}
            price={`${formatCurrency(c.weeklyFee, d.currency)}/wk`}
          />
        ))}
      </div>
    </Card>
  )
}

function ProgramRow({
  href,
  title,
  tag,
  meta,
  price,
}: {
  href: string
  title: string
  tag: string
  meta: string
  price: string
}) {
  return (
    <Link
      href={href}
      className="border-ink-100 hover:border-hoop-300 hover:shadow-soft block cursor-pointer rounded-2xl border p-4 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-ink-950 font-medium">{title}</h3>
            <span className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
              {tag}
            </span>
          </div>
          <p className="text-ink-500 mt-0.5 text-sm">{meta}</p>
        </div>
        <div className="text-hoop-600 flex-shrink-0 font-bold">{price}</div>
      </div>
    </Link>
  )
}

function TeamsBlock({ d }: { d: ClubPageData }) {
  return (
    <Card>
      <h2 className={H2}>Teams ({d.teams.length})</h2>
      {d.teams.length === 0 ? (
        <p className="text-ink-500 text-sm">No teams listed yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {d.teams.map((team: any) => (
            <Link
              key={team.id}
              href={`/team/${team.id}`}
              className="hover:border-play-200 border-ink-100 bg-ink-50 group cursor-pointer rounded-2xl border p-4 transition hover:bg-white"
            >
              <h3 className="group-hover:text-play-600 text-ink-950 font-medium transition-colors">
                {team.name}
              </h3>
              <p className="text-ink-500 text-sm">
                {team.ageGroup}
                {team.gender ? ` • ${team.gender}` : ""}
                {team.season ? ` • ${team.season}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

function ScheduleBlock({ d }: { d: ClubPageData }) {
  if (d.recentGames.length + d.upcomingGames.length === 0) return null
  return (
    <Card>
      <h2 className={H2}>Schedule &amp; scores</h2>
      {d.upcomingGames.length > 0 && (
        <>
          <h3 className="text-ink-500 mb-2 text-xs font-semibold uppercase">Upcoming</h3>
          <div className="mb-4 space-y-2">
            {d.upcomingGames.map((g: any) => (
              <GameRow key={g.id} g={g} />
            ))}
          </div>
        </>
      )}
      {d.recentGames.length > 0 && (
        <>
          <h3 className="text-ink-500 mb-2 text-xs font-semibold uppercase">Recent results</h3>
          <div className="space-y-2">
            {d.recentGames.map((g: any) => (
              <GameRow key={g.id} g={g} final />
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function GameRow({ g, final }: { g: any; final?: boolean }) {
  return (
    <Link
      href={`/live/${g.id}`}
      className="border-ink-100 hover:bg-ink-50 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition"
    >
      <span className="text-ink-800 min-w-0 truncate">
        {g.homeTeam?.name} <span className="text-ink-400">vs</span> {g.awayTeam?.name}
      </span>
      <span className="text-ink-500 flex-shrink-0 pl-3 text-xs">
        {final && g.homeScore != null && g.awayScore != null
          ? `${g.homeScore}–${g.awayScore}`
          : format(new Date(g.scheduledAt), "MMM d, h:mm a")}
      </span>
    </Link>
  )
}

function NewsBlock({ d }: { d: ClubPageData }) {
  if (d.news.length === 0) return null
  return (
    <Card>
      <h2 className={H2}>News &amp; highlights</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {d.news.map((post: any) => {
          const m = post.media?.[0]
          const img = m?.posterUrl || (m?.type === "IMAGE" ? m?.url : null)
          return (
            <Link
              key={post.id}
              href={`/news/${post.slug}`}
              className="group border-ink-100 hover:border-hoop-300 hover:shadow-soft block cursor-pointer overflow-hidden rounded-2xl border transition"
            >
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-32 w-full object-cover" />
              )}
              <div className="p-3">
                <h3 className="text-ink-900 group-hover:text-hoop-600 text-sm font-semibold transition">
                  {post.title}
                </h3>
                {post.publishedAt && (
                  <p className="text-ink-400 mt-1 text-xs">
                    {format(new Date(post.publishedAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

function ReviewsBlock({ d }: { d: ClubPageData }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-950 text-lg font-bold">
          Reviews{d.totalReviews > 0 ? ` (${d.totalReviews})` : ""}
        </h2>
        {d.averageRating !== null && (
          <StarRating rating={d.averageRating} count={d.totalReviews} size="md" />
        )}
      </div>
      {d.reviews.length === 0 ? (
        <p className="text-ink-500 mb-4 text-sm">
          No reviews yet — be the first family to share your experience.
        </p>
      ) : (
        <div className="mb-6 space-y-4">
          {d.reviews.map((review: any) => (
            <div key={review.id} className="border-ink-100 rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StarRating rating={review.rating} />
                <span className="text-ink-400 text-xs">
                  {[review.reviewer.firstName, review.reviewer.lastName?.[0] ? `${review.reviewer.lastName[0]}.` : ""]
                    .filter(Boolean)
                    .join(" ") || "A family"}
                  {" · "}
                  {format(new Date(review.createdAt), "MMM yyyy")}
                </span>
              </div>
              {review.title && (
                <h3 className="text-ink-900 mt-2 text-sm font-semibold">{review.title}</h3>
              )}
              {review.content && (
                <p className="text-ink-700 mt-1 whitespace-pre-line text-sm">{review.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
      <ReviewForm tenantId={d.club.id} signedIn={d.signedIn} alreadyReviewed={d.alreadyReviewed} />
    </Card>
  )
}

function NextGameBlock({ d, variant }: { d: ClubPageData; variant: Variant }) {
  const g = d.upcomingGames[0]
  if (!g) return null
  return (
    <Card>
      <h3 className={variant === "rail" ? railTitle : H2}>Next game</h3>
      <Link href={`/live/${g.id}`} className="block cursor-pointer">
        <div className="text-ink-900 font-semibold">
          {g.homeTeam?.name} <span className="text-ink-400">vs</span> {g.awayTeam?.name}
        </div>
        <div className="text-ink-500 mt-1 text-sm">
          {format(new Date(g.scheduledAt), "EEE MMM d • h:mm a")}
        </div>
      </Link>
    </Card>
  )
}

function ContactBlock({ d, variant }: { d: ClubPageData; variant: Variant }) {
  const c = d.club
  if (!(c.address || c.phoneNumber || c.contactEmail || c.website)) return null
  return (
    <Card>
      <h3 className={variant === "rail" ? railTitle : H2}>Contact</h3>
      <div className="space-y-3 text-sm">
        {c.address && (
          <Field label="Address">
            <div className="text-ink-700">{c.address}</div>
            <div className="text-ink-700">
              {[c.city, c.state, c.zipCode].filter(Boolean).join(", ")}
            </div>
          </Field>
        )}
        {c.phoneNumber && (
          <Field label="Phone">
            <a href={`tel:${c.phoneNumber}`} className="text-ink-700 hover:text-hoop-600">
              {c.phoneNumber}
            </a>
          </Field>
        )}
        {c.contactEmail && (
          <Field label="Email">
            <a href={`mailto:${c.contactEmail}`} className="text-ink-700 hover:text-hoop-600 break-all">
              {c.contactEmail}
            </a>
          </Field>
        )}
        {c.website && (
          <Field label="Website">
            <a
              href={c.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hoop-600 hover:underline"
            >
              {c.website.replace(/^https?:\/\//, "")}
            </a>
          </Field>
        )}
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-ink-500 text-xs font-medium uppercase">{label}</div>
      {children}
    </div>
  )
}

function StatsBlock({ d }: { d: ClubPageData }) {
  return (
    <Card>
      <h3 className={railTitle}>At a glance</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-hoop-600 text-2xl font-bold">{d.teams.length}</div>
          <div className="text-ink-500 text-xs">Teams</div>
        </div>
        <div>
          <div className="text-court-600 text-2xl font-bold">{d.tryouts.length}</div>
          <div className="text-ink-500 text-xs">Tryouts</div>
        </div>
        <div>
          <div className="text-play-600 text-2xl font-bold">{d.staffCount}</div>
          <div className="text-ink-500 text-xs">Staff</div>
        </div>
      </div>
      {d.averageRating !== null && (
        <div className="border-ink-100 mt-4 flex justify-center border-t pt-4">
          <StarRating rating={d.averageRating} count={d.totalReviews} size="md" />
        </div>
      )}
    </Card>
  )
}

function socialLinks(socials: any): Array<{ key: string; label: string; href: string }> {
  if (!socials || typeof socials !== "object") return []
  const map: Record<string, { label: string; base: string }> = {
    instagram: { label: "Instagram", base: "https://instagram.com/" },
    facebook: { label: "Facebook", base: "https://facebook.com/" },
    x: { label: "X", base: "https://x.com/" },
    youtube: { label: "YouTube", base: "" },
    tiktok: { label: "TikTok", base: "https://tiktok.com/@" },
  }
  const out: Array<{ key: string; label: string; href: string }> = []
  for (const [key, cfg] of Object.entries(map)) {
    const v = socials[key]
    if (typeof v === "string" && v.trim()) {
      const val = v.trim()
      const href = /^https?:\/\//.test(val)
        ? val
        : cfg.base + val.replace(/^@/, "")
      out.push({ key, label: cfg.label, href })
    }
  }
  return out
}

function SocialsBlock({ d }: { d: ClubPageData }) {
  const links = socialLinks(d.club.branding?.socials)
  if (links.length === 0) return null
  return (
    <Card>
      <h3 className={railTitle}>Follow us</h3>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="border-ink-200 text-ink-700 hover:bg-ink-50 cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-medium transition"
          >
            {l.label}
          </a>
        ))}
      </div>
    </Card>
  )
}
