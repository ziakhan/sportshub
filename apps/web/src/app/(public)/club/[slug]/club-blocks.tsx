import Link from "next/link"
import type { ReactNode } from "react"
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

// ─── Brand-carry class atoms ────────────────────────────────────────────────
// The wrapper sets --brand* CSS vars (see lib/club-page/brand.ts); these static
// classes read them, so the brand color flows through the whole page.
const BRAND_INK = "text-[color:var(--brand-ink)]"
const BRAND_HOVER = "group-hover:text-[color:var(--brand-ink)]"
const BRAND_LINE = "border-[color:var(--brand-line)]"
const BRAND_SOFT = "bg-[var(--brand-soft)]"
const BRAND_CHIP = "bg-[var(--brand-soft)] text-[color:var(--brand-ink)]"
// Hover variants must exist as literal tokens so Tailwind's JIT scanner emits
// them (it reads source text, not composed runtime strings).
const BRAND_LINE_HOVER = "hover:border-[color:var(--brand-line)]"
const BRAND_INK_HOVER = "hover:text-[color:var(--brand-ink)]"

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
          <BlockHeader title="About" />
          <p className="text-ink-700 whitespace-pre-line text-[15px] leading-relaxed">
            {d.club.description}
          </p>
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
      return <NextGameBlock d={d} />
    case "contact":
      return <ContactBlock d={d} />
    case "stats":
      return <StatsBlock d={d} />
    case "socials":
      return <SocialsBlock d={d} />
    default:
      return null
  }
}

// ─── Section headers ────────────────────────────────────────────────────────

function BlockHeader({
  title,
  count,
  action,
}: {
  title: string
  count?: number
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-3">
        <span aria-hidden className="h-7 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
        <span className="font-condensed text-ink-950 text-[26px] font-bold uppercase leading-none tracking-wide">
          {title}
          {count != null && <span className="text-ink-300 ml-2">{count}</span>}
        </span>
      </h2>
      {action}
    </div>
  )
}

function RailHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2.5">
      <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-[var(--brand)]" />
      <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
        {title}
      </span>
    </h3>
  )
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

function AnnouncementsBlock({ d, variant }: { d: ClubPageData; variant: Variant }) {
  if (d.announcements.length === 0) return null
  const items = variant === "rail" ? d.announcements.slice(0, 4) : d.announcements
  return (
    <Card>
      {variant === "rail" ? <RailHeader title="Announcements" /> : <BlockHeader title="Announcements" />}
      <div className="space-y-3">
        {items.map((a: any) => (
          <div
            key={a.id}
            className={`rounded-2xl border p-4 ${
              a.isPinned ? `${BRAND_SOFT} ${BRAND_LINE}` : "border-ink-100"
            }`}
          >
            <div className="flex items-start gap-2">
              {a.isPinned && (
                <span
                  className={`${BRAND_CHIP} mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide`}
                >
                  Pinned
                </span>
              )}
              <div className="min-w-0">
                <h4 className="text-ink-900 text-sm font-semibold">{a.title}</h4>
                <p className="text-ink-600 mt-1 whitespace-pre-line text-sm leading-relaxed">
                  {a.content}
                </p>
                <p className="text-ink-400 mt-1.5 text-xs">
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
  const count = d.tryouts.length + d.houseLeagues.length + d.camps.length
  if (count === 0) return null
  return (
    <div className={`${BRAND_SOFT} ${BRAND_LINE} overflow-hidden rounded-[28px] border p-6 sm:p-7`}>
      <BlockHeader title="Open programs" count={count} />
      <div className="grid gap-3 sm:grid-cols-2">
        {d.tryouts.map((t: any) => (
          <ProgramRow
            key={`t-${t.id}`}
            href={`/tryout/${t.id}`}
            title={t.title}
            tag="Tryout"
            meta={`${format(new Date(t.scheduledAt), "MMM d, yyyy")} · ${t.location}`}
            price={t.fee === 0 ? "FREE" : formatCurrency(t.fee, d.currency)}
          />
        ))}
        {d.houseLeagues.map((l: any) => (
          <ProgramRow
            key={`h-${l.id}`}
            href={`/house-league/${l.id}`}
            title={l.name}
            tag="House league"
            meta={`${l.ageGroups}${l.season ? ` · ${l.season}` : ""} · ${l.location}`}
            price={l.fee === 0 ? "FREE" : formatCurrency(l.fee, d.currency)}
          />
        ))}
        {d.camps.map((c: any) => (
          <ProgramRow
            key={`c-${c.id}`}
            href={`/camp/${c.id}`}
            title={c.name}
            tag="Camp"
            meta={`${c.ageGroup} · ${c.numberOfWeeks} week${c.numberOfWeeks !== 1 ? "s" : ""} · ${c.location}`}
            price={`${formatCurrency(c.weeklyFee, d.currency)}/wk`}
          />
        ))}
      </div>
    </div>
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
  const free = price === "FREE"
  return (
    <Link
      href={href}
      className={`brand-focus card-lift group border-ink-100 block cursor-pointer rounded-2xl border bg-white p-4 ${BRAND_LINE_HOVER}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`${BRAND_CHIP} rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide`}
            >
              {tag}
            </span>
            <span className="text-court-700 bg-court-50 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
              <span aria-hidden className="bg-court-500 h-1.5 w-1.5 rounded-full" />
              Registering
            </span>
          </div>
          <h3
            className={`text-ink-950 mt-1.5 font-semibold leading-snug ${BRAND_HOVER} transition-colors`}
          >
            {title}
          </h3>
          <p className="text-ink-500 mt-0.5 text-sm">{meta}</p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-condensed text-2xl font-bold leading-none ${
              free ? "text-court-600" : BRAND_INK
            }`}
          >
            {price}
          </div>
          <div className="text-ink-400 mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide">
            Register
            <IconArrow />
          </div>
        </div>
      </div>
    </Link>
  )
}

function teamInitials(name: string): string {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "T"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function TeamsBlock({ d }: { d: ClubPageData }) {
  return (
    <Card>
      <BlockHeader title="Teams" count={d.teams.length} />
      {d.teams.length === 0 ? (
        <p className="text-ink-500 text-sm">No teams listed yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {d.teams.map((team: any) => (
            <Link
              key={team.id}
              href={`/team/${team.id}`}
              className={`brand-focus card-lift group border-ink-100 flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-3.5 ${BRAND_LINE_HOVER}`}
            >
              <span
                className={`${BRAND_CHIP} font-condensed grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold uppercase`}
              >
                {teamInitials(team.name)}
              </span>
              <div className="min-w-0">
                <h3
                  className={`text-ink-950 truncate font-semibold ${BRAND_HOVER} transition-colors`}
                >
                  {team.name}
                </h3>
                <p className="text-ink-500 truncate text-sm">
                  {[team.ageGroup, team.gender, team.season].filter(Boolean).join(" · ")}
                </p>
              </div>
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
      <BlockHeader title="Schedule & scores" />
      {d.upcomingGames.length > 0 && (
        <>
          <SubHead>Upcoming</SubHead>
          <div className="mb-5 space-y-2">
            {d.upcomingGames.map((g: any) => (
              <GameRow key={g.id} g={g} />
            ))}
          </div>
        </>
      )}
      {d.recentGames.length > 0 && (
        <>
          <SubHead>Recent results</SubHead>
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

function SubHead({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-ink-400 mb-2 text-[11px] font-bold uppercase tracking-[0.14em]">{children}</h4>
  )
}

function GameRow({ g, final }: { g: any; final?: boolean }) {
  const live = g.status === "LIVE"
  return (
    <Link
      href={`/live/${g.id}`}
      className={`brand-focus group border-ink-100 flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--brand-softer)] ${BRAND_LINE_HOVER}`}
    >
      <span className="text-ink-800 min-w-0 truncate font-medium">
        {g.homeTeam?.name} <span className="text-ink-300 font-normal">vs</span> {g.awayTeam?.name}
      </span>
      {final && g.homeScore != null && g.awayScore != null ? (
        <span className="bg-ink-50 text-ink-950 font-condensed shrink-0 rounded-lg px-2.5 py-0.5 text-sm font-bold tabular-nums">
          {g.homeScore}–{g.awayScore}
        </span>
      ) : live ? (
        <span className="text-live-600 bg-live-50 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase">
          <span aria-hidden className="bg-live-500 h-1.5 w-1.5 animate-pulse rounded-full" />
          Live
        </span>
      ) : (
        <span className="text-ink-500 shrink-0 whitespace-nowrap text-xs">
          {format(new Date(g.scheduledAt), "MMM d · h:mm a")}
        </span>
      )}
    </Link>
  )
}

function NewsBlock({ d }: { d: ClubPageData }) {
  if (d.news.length === 0) return null
  const [featured, ...rest] = d.news
  return (
    <Card>
      <BlockHeader
        title="News & highlights"
        action={
          <Link
            href="/news"
            className={`${BRAND_INK} hidden text-sm font-semibold hover:underline sm:inline`}
          >
            All news →
          </Link>
        }
      />
      <FeaturedNews post={featured} />
      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rest.map((post: any) => (
            <NewsCardSmall key={post.id} post={post} />
          ))}
        </div>
      )}
    </Card>
  )
}

function newsImage(post: any): string | null {
  const m = post.media?.[0]
  return m?.posterUrl || (m?.type === "IMAGE" ? m?.url : null)
}

function FeaturedNews({ post }: { post: any }) {
  const img = newsImage(post)
  return (
    <Link
      href={`/news/${post.slug}`}
      className="brand-focus card-lift group border-ink-100 block cursor-pointer overflow-hidden rounded-2xl border bg-white"
    >
      {img && (
        <div className="relative aspect-[16/7] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
          />
          <span className="absolute left-3 top-3 rounded-full bg-[var(--brand)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand-on)]">
            Latest
          </span>
        </div>
      )}
      <div className="p-4">
        <h3
          className={`font-condensed text-ink-950 text-xl font-bold uppercase leading-tight tracking-wide ${BRAND_HOVER} transition-colors`}
        >
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
}

function NewsCardSmall({ post }: { post: any }) {
  const img = newsImage(post)
  return (
    <Link
      href={`/news/${post.slug}`}
      className={`brand-focus card-lift group border-ink-100 block cursor-pointer overflow-hidden rounded-2xl border bg-white ${BRAND_LINE_HOVER}`}
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-28 w-full object-cover" />
      )}
      <div className="p-3">
        <h4 className={`text-ink-900 text-sm font-semibold leading-snug ${BRAND_HOVER} transition-colors`}>
          {post.title}
        </h4>
        {post.publishedAt && (
          <p className="text-ink-400 mt-1 text-xs">
            {format(new Date(post.publishedAt), "MMM d, yyyy")}
          </p>
        )}
      </div>
    </Link>
  )
}

function ReviewsBlock({ d }: { d: ClubPageData }) {
  return (
    <Card>
      <BlockHeader
        title="Reviews"
        count={d.totalReviews > 0 ? d.totalReviews : undefined}
        action={
          d.averageRating !== null ? (
            <StarRating rating={d.averageRating} count={d.totalReviews} size="md" />
          ) : undefined
        }
      />
      {d.reviews.length === 0 ? (
        <p className="text-ink-500 mb-4 text-sm">
          No reviews yet — be the first family to share your experience.
        </p>
      ) : (
        <div className="mb-6 space-y-4">
          {d.reviews.map((review: any) => {
            const name =
              [
                review.reviewer.firstName,
                review.reviewer.lastName?.[0] ? `${review.reviewer.lastName[0]}.` : "",
              ]
                .filter(Boolean)
                .join(" ") || "A family"
            return (
              <div key={review.id} className={`${BRAND_LINE} rounded-2xl border-l-[3px] bg-ink-50/40 p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StarRating rating={review.rating} />
                  <span className="text-ink-400 text-xs">
                    {name}
                    {" · "}
                    {format(new Date(review.createdAt), "MMM yyyy")}
                  </span>
                </div>
                {review.title && (
                  <h3 className="text-ink-900 mt-2 text-sm font-semibold">{review.title}</h3>
                )}
                {review.content && (
                  <p className="text-ink-700 mt-1 whitespace-pre-line text-sm leading-relaxed">
                    {review.content}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
      <ReviewForm tenantId={d.club.id} signedIn={d.signedIn} alreadyReviewed={d.alreadyReviewed} />
    </Card>
  )
}

function NextGameBlock({ d }: { d: ClubPageData }) {
  const g = d.upcomingGames[0]
  if (!g) return null
  const live = g.status === "LIVE"
  return (
    <Card>
      <RailHeader title="Next game" />
      <Link href={`/live/${g.id}`} className="brand-focus group block cursor-pointer">
        <div className={`text-ink-950 font-semibold ${BRAND_HOVER} transition-colors`}>
          {g.homeTeam?.name} <span className="text-ink-300 font-normal">vs</span> {g.awayTeam?.name}
        </div>
        {live ? (
          <span className="text-live-600 bg-live-50 mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold uppercase">
            <span aria-hidden className="bg-live-500 h-1.5 w-1.5 animate-pulse rounded-full" />
            Live now
          </span>
        ) : (
          <span
            className={`${BRAND_CHIP} mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium`}
          >
            <IconClock />
            {format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
          </span>
        )}
      </Link>
    </Card>
  )
}

function ContactBlock({ d }: { d: ClubPageData }) {
  const c = d.club
  if (!(c.address || c.phoneNumber || c.contactEmail || c.website)) return null
  return (
    <Card>
      <RailHeader title="Contact" />
      <div className="space-y-3.5 text-sm">
        {c.address && (
          <Field icon={<IconPin />}>
            <div className="text-ink-700">{c.address}</div>
            <div className="text-ink-500">{[c.city, c.state, c.zipCode].filter(Boolean).join(", ")}</div>
          </Field>
        )}
        {c.phoneNumber && (
          <Field icon={<IconPhone />}>
            <a href={`tel:${c.phoneNumber}`} className={`text-ink-700 ${BRAND_INK_HOVER} transition-colors`}>
              {c.phoneNumber}
            </a>
          </Field>
        )}
        {c.contactEmail && (
          <Field icon={<IconMail />}>
            <a
              href={`mailto:${c.contactEmail}`}
              className={`text-ink-700 ${BRAND_INK_HOVER} break-all transition-colors`}
            >
              {c.contactEmail}
            </a>
          </Field>
        )}
        {c.website && (
          <Field icon={<IconGlobe />}>
            <a
              href={c.website}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BRAND_INK} font-medium hover:underline`}
            >
              {c.website.replace(/^https?:\/\//, "")}
            </a>
          </Field>
        )}
      </div>
    </Card>
  )
}

function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`${BRAND_INK} mt-0.5 shrink-0`}>{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function StatsBlock({ d }: { d: ClubPageData }) {
  const stats = [
    { value: d.teams.length, label: "Teams", cls: BRAND_INK },
    { value: d.tryouts.length + d.houseLeagues.length + d.camps.length, label: "Programs", cls: "text-court-600" },
    { value: d.staffCount, label: "Staff", cls: "text-ink-700" },
  ]
  return (
    <Card>
      <RailHeader title="At a glance" />
      <div className="grid grid-cols-3 gap-3 text-center">
        {stats.map((s) => (
          <div key={s.label} className="bg-ink-50/60 rounded-2xl py-3">
            <div className={`font-condensed text-3xl font-bold leading-none ${s.cls}`}>{s.value}</div>
            <div className="text-ink-500 mt-1 text-xs font-medium">{s.label}</div>
          </div>
        ))}
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
      const href = /^https?:\/\//.test(val) ? val : cfg.base + val.replace(/^@/, "")
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
      <RailHeader title="Follow us" />
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`brand-focus border-ink-200 text-ink-700 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${BRAND_LINE_HOVER} hover:bg-[var(--brand-softer)] ${BRAND_INK_HOVER}`}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
            {l.label}
          </a>
        ))}
      </div>
    </Card>
  )
}

// ─── Icons (16px, currentColor) ─────────────────────────────────────────────

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}
function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path
        d="M4 5c0 8.284 6.716 15 15 15a1.5 1.5 0 001.5-1.5v-2.086a1 1 0 00-.757-.97l-3.29-.822a1 1 0 00-1.024.36l-.67.892a11.05 11.05 0 01-4.86-4.86l.893-.67a1 1 0 00.36-1.024l-.823-3.29A1 1 0 007.586 3.5H5.5A1.5 1.5 0 004 5z"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  )
}
