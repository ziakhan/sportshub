"use client"

import type { CSSProperties, ReactNode } from "react"
import { Crest } from "@/components/ui/crest"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { TypeText } from "../motion"
import {
  MockBand,
  MockButton,
  MockChips,
  MockEndCard,
  MockField,
  MockPill,
  MockTextArea,
  MockTile,
  MockTopBar,
} from "../mock-ui"
import type { DemoScript } from "../types"

/**
 * Chapter 5: "Claim your club and make it yours" (owner-signed script,
 * 2026-08-15).
 *
 * THE ARGUMENT. A club owner's first experience of this product is not a signup
 * form. It is finding a page about their own club that somebody else's public
 * league listing built, with their city right and everything else thin. The
 * question they ask is "how do I get control of that", and the answer has to be
 * something they can do in a minute without an account.
 *
 * THE PAINFUL DETAIL (owner's law): SHOW WHO THE CODE GOES TO. Anyone can type
 * an email address, so a claim that emails whatever you type proves nothing.
 * This one sends to the contact ALREADY ON FILE, masked on screen, and the
 * demo stops on that masked address long enough to read it. The correction
 * path is shown next to it, because the listing is usually a little wrong and
 * pretending otherwise is how a claim flow loses the person.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the directory — app/(public)/club/page.tsx and club-search.tsx: the
 *     "Clubs / Find a Basketball Club" daylight band, the "Start typing a club
 *     name..." field with its live dropdown of crest, name, "city, state" and
 *     team count, the city pills, and the "Top clubs" grid. The badge on an
 *     unclaimed card really does read "Open profile", not "Unclaimed";
 *   · the club page — app/(public)/club/[slug]/page.tsx: crest, name, city
 *     pill, description, the "View programs" and "Contact" row, the four stat
 *     tiles, the sticky About / Teams / Programs / Schedule / Contact sub-nav,
 *     and the 4px baseline stripe that is navy until a club picks a colour.
 *     An unclaimed club gets the dark "Claim this club" button where a claimed
 *     one gets Follow, which is the whole difference between the two states;
 *   · the claim wizard — app/(public)/claim/[tenantId]: "Claim your club" over
 *     the club name, the three channels (email a code, text a code, submit
 *     proof), "Our info looks wrong? Propose corrections", "Send the code",
 *     the six-digit box with its 30 minute line, "Verify", the Verified badge
 *     with the 14 day reservation, and "Take ownership";
 *   · the completion — claim/complete: "Club claimed" and "You're the owner.
 *     Everything about the club is now yours to edit.";
 *   · the branding surface — clubs/[id]/customize: "Customize your public
 *     page", the Brand card with Banner image and Logo upload tiles, Tagline,
 *     Description, and the primary, secondary and accent colour pickers, over
 *     the sticky "Save changes" bar.
 *
 * Two copy notes. The product's own claim body carries an em-dash; the house
 * rule does not allow one, so the same sentence is punctuated with a full stop
 * here. And `hasChosenBrand()` in lib/club-page/brand.ts is why the before and
 * after look so different: an unclaimed club can never render a colour, so the
 * crest and the stripe are navy until the moment somebody claims it and picks
 * one.
 *
 * MOTION. Nothing pans, zooms or scrolls. Screens cross-fade, the wizard steps
 * pop, the colour swatches and the crest change in place, and the last move is
 * the public page reloading decorated: the before and after are the same
 * layout with the club's own colour, mark and words in it.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const CLUB = "Riverside Ravens"
const CITY = "Toronto, ON"
const MASKED_EMAIL = "d••••@riversideravens.ca"
const MASKED_PHONE = "(416) •••-••82"
const CODE = "418206"

/** The colour the club picks on camera. Nothing renders it before that. */
const BRAND = "#4c2a85"
const SECONDARY = "#f2b705"

const TAGLINE = "Developing guards since 2009"
const DESCRIPTION =
  "Rep and house league basketball on the west side. Coaching that lasts past the buzzer."

const URL_DIRECTORY = "/club"
const URL_CLUB = "/club/riverside-ravens"
const URL_CLAIM = "/claim/riverside-ravens"
const URL_COMPLETE = "/claim/complete"
const URL_CUSTOMIZE = "/clubs/riverside-ravens/customize"

/** What the directory holds today: imported clubs nobody has logged into yet. */
const DIRECTORY = [
  { name: "Riverside Ravens", city: "Toronto, ON", teams: 6, open: true, id: "ravens" },
  { name: "Lakeshore Lightning", city: "Etobicoke, ON", teams: 8, open: false, id: "lightning" },
  { name: "Northside Nets", city: "North York, ON", teams: 5, open: true, id: "nets" },
  { name: "Harbourfront Heat", city: "Toronto, ON", teams: 4, open: true, id: "heat" },
  { name: "Bramalea Blaze", city: "Brampton, ON", teams: 9, open: false, id: "blaze" },
  { name: "Credit Valley Kings", city: "Mississauga, ON", teams: 7, open: true, id: "kings" },
]

const SUGGESTIONS = [
  { id: "ravens", name: "Riverside Ravens", meta: "Toronto, ON · 6 teams" },
  { id: "riverside-rush", name: "Riverside Rush", meta: "Cambridge, ON · 3 teams" },
  { id: "riverside-rec", name: "Riverside Rec Youth", meta: "Guelph, ON · 2 teams" },
]

const CITIES = [
  { value: "all", label: "All cities" },
  { value: "toronto", label: "Toronto" },
  { value: "mississauga", label: "Mississauga" },
  { value: "brampton", label: "Brampton" },
  { value: "hamilton", label: "Hamilton" },
]

export const claimStory: DemoScript = {
  desktopUrl: URL_DIRECTORY,
  initialStage: "desktop",
  chapters: [
    { id: "find", title: "Find your club" },
    { id: "claim", title: "Claim it" },
    { id: "mine", title: "Make it yours" },
  ],

  beats: [
    /* ── 1. Find your club ────────────────────────────────────────────── */
    {
      id: "directory",
      chapter: "find",
      caption:
        "Your club is probably already in here. Eleven hundred Ontario clubs were built from public league listings, and nobody at any of them has ever logged in.",
      hold: 3000,
      set: { screen: "directory" },
    },
    {
      id: "search",
      chapter: "find",
      caption: "So the first move is not signing up. It is looking yourself up.",
      hold: 2900,
      cursor: "search-field",
      type: { key: "query", text: "riverside" },
      set: { suggest: true },
    },
    {
      id: "pick",
      chapter: "find",
      caption: "There it is, with the city and the team count the league listing already knew.",
      hold: 2400,
      cursor: "suggest-ravens",
      press: true,
    },
    {
      id: "club-page",
      chapter: "find",
      caption:
        "This page has been live for months. Six teams, a city, and nothing else: no colours, no crest, no words anybody at the club wrote.",
      hold: 3200,
      url: URL_CLUB,
      set: { screen: "club", suggest: false },
    },
    {
      id: "claim-hover",
      chapter: "find",
      caption:
        "Which is why an open profile carries one dark button that a claimed club does not have.",
      hold: 2600,
      cursor: "claim-cta",
      hover: "claim-cta",
    },

    /* ── 2. Claim it ──────────────────────────────────────────────────── */
    {
      id: "claim-press",
      chapter: "claim",
      caption: "Claim this club.",
      hold: 2000,
      cursor: "claim-cta",
      press: true,
    },
    {
      id: "claim-open",
      chapter: "claim",
      caption:
        "No account yet. Proving you run the club comes first, and the account comes after.",
      hold: 2800,
      url: URL_CLAIM,
      set: { screen: "claim", step: "options" },
    },
    {
      id: "contact-on-file",
      chapter: "claim",
      caption:
        "Here is the part that makes it a claim and not a form. The code goes to the contact already on file, masked on screen, so nobody can type their way into somebody else's club.",
      hold: 3400,
      cursor: "channel-email",
      hover: "channel-email",
    },
    {
      id: "corrections",
      chapter: "claim",
      caption:
        "And because an imported listing is usually a little wrong, the corrections sit right there instead of behind a support email.",
      hold: 2800,
      cursor: "corrections",
      hover: "corrections",
    },
    {
      id: "send-code",
      chapter: "claim",
      caption: "Send the code.",
      hold: 2000,
      cursor: "send-code",
      press: true,
    },
    {
      id: "code-step",
      chapter: "claim",
      caption: "Six digits, good for thirty minutes, five tries.",
      hold: 2400,
      toast: `Code sent to ${MASKED_EMAIL}`,
      set: { step: "code" },
    },
    {
      id: "type-code",
      chapter: "claim",
      caption: "She reads it out of the club inbox she has had since 2009.",
      hold: 2600,
      cursor: "code-input",
      type: { key: "code", text: CODE },
    },
    {
      id: "verify-press",
      chapter: "claim",
      caption: "Verify.",
      hold: 2000,
      cursor: "verify",
      press: true,
    },
    {
      id: "verified",
      chapter: "claim",
      caption:
        "Verified, and held for fourteen days. The club binds to her account, not to the inbox that got the code, so it survives the day that address stops working.",
      hold: 3200,
      set: { step: "verified" },
    },
    {
      id: "own-press",
      chapter: "claim",
      caption: "Take ownership.",
      hold: 2000,
      cursor: "take-ownership",
      press: true,
    },
    {
      id: "claimed",
      chapter: "claim",
      caption: "That is the whole claim. About a minute, and no phone call to anybody.",
      hold: 2800,
      url: URL_COMPLETE,
      set: { step: "claimed" },
    },

    /* ── 3. Make it yours ─────────────────────────────────────────────── */
    {
      id: "customize",
      chapter: "mine",
      caption:
        "The page she just unlocked is the public one, edited from the same screen families read.",
      hold: 2800,
      url: URL_CUSTOMIZE,
      set: { screen: "customize" },
    },
    {
      id: "primary",
      chapter: "mine",
      caption:
        "Colour first, because until a club picks one the site refuses to invent it. Every crest and stripe stays navy on purpose.",
      hold: 3000,
      cursor: "swatch-primary",
      press: true,
      set: { brand: BRAND },
    },
    {
      id: "secondary",
      chapter: "mine",
      caption: "Secondary and accent sit beside it. A club has more than one colour.",
      hold: 2200,
      cursor: "swatch-secondary",
      press: true,
      set: { secondary: SECONDARY },
    },
    {
      id: "logo",
      chapter: "mine",
      caption: "The crest goes up as an upload, and it wins over the monogram everywhere.",
      hold: 2600,
      cursor: "logo-upload",
      press: true,
      set: { logo: true },
      toast: "Logo uploaded",
    },
    {
      id: "tagline",
      chapter: "mine",
      caption: "The line under the name.",
      hold: 2400,
      cursor: "field-tagline",
      type: { key: "tagline", text: TAGLINE },
    },
    {
      id: "description",
      chapter: "mine",
      caption: "Then the paragraph a family reads before they call anybody.",
      hold: 3600,
      cursor: "field-description",
      type: { key: "description", text: DESCRIPTION },
    },
    {
      id: "save",
      chapter: "mine",
      caption: "Save.",
      hold: 2200,
      cursor: "save-changes",
      press: true,
      toast: "Saved. Your public page is updated.",
    },
    {
      id: "flip",
      chapter: "mine",
      caption:
        "Same page, same address, same afternoon. The crest is theirs, the stripe is their colour, the words are their words, and the claim button is gone because there is nothing left to claim.",
      hold: 4000,
      url: URL_CLUB,
      set: { screen: "club", claimed: true },
    },
    {
      id: "end-card",
      chapter: "mine",
      caption: "A page that already existed, in the hands of the people it is about.",
      hold: 3800,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "directory")
    const step = get<string>("step", "options")
    const claimed = get("claimed", false)
    const brand = get<string>("brand", "")
    const secondary = get<string>("secondary", "")
    const logo = get("logo", false)
    const endCard = get("endCard", false)

    const typed = (key: string, placeholder?: string) => (
      <TypeText text={get<string>(key, "")} typing={typingKey === key} placeholder={placeholder} />
    )

    const desktop = (
      <div className="relative flex h-full flex-col">
        {screen === "customize" ? (
          <MockTopBar
            workspace={CLUB}
            tabs={["Dashboard", "Teams", "Programs", "Public page"]}
            activeTab="Public page"
          />
        ) : (
          <PublicTopBar />
        )}

        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "directory" && (
            <DirectoryScreen query={typed("query", "Start typing a club name...")} suggest={get("suggest", false)} />
          )}
          {screen === "club" && (
            <ClubPublicScreen
              claimed={claimed}
              brand={claimed ? brand : ""}
              logo={claimed && logo}
              tagline={claimed ? get<string>("tagline", "") : ""}
              description={claimed ? get<string>("description", "") : ""}
            />
          )}
          {screen === "claim" && (
            <ClaimScreen step={step} code={typed("code", "••••••")} />
          )}
          {screen === "customize" && (
            <CustomizeScreen
              brand={brand}
              secondary={secondary}
              logo={logo}
              tagline={typed("tagline", "e.g. Developing players since 2009")}
              description={typed(
                "description",
                "A paragraph about your club: who you are, your philosophy, what families can expect."
              )}
            />
          )}
        </div>

        {endCard && (
          <MockEndCard
            eyebrow="Chapter 5 of 10"
            title="Claim your club"
            line="The page was already there. Ninety seconds of proof and a colour picker is the difference between a listing about your club and a page that belongs to it."
            next="Your week"
          />
        )}
      </div>
    )

    return { desktop }
  },
}

/* ── Public chrome ────────────────────────────────────────────────────────── */

/** The signed-out site header. A claim starts before anybody has an account. */
function PublicTopBar() {
  return (
    <div className="border-ink-100 flex items-center gap-4 border-b bg-white px-5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="bg-court-900 flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white">
          SH
        </span>
        <span className="text-ink-900 text-sm font-semibold">SportsHub</span>
      </div>
      <nav className="ml-4 flex items-center gap-1">
        {["Clubs", "Leagues", "Scores", "News"].map((t) => (
          <span
            key={t}
            className={
              t === "Clubs"
                ? "bg-ink-900 rounded-full px-3 py-1 text-[13px] font-medium text-white"
                : "text-ink-500 rounded-full px-3 py-1 text-[13px] font-medium"
            }
          >
            {t}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-ink-600 text-[12.5px] font-semibold">Sign in</span>
        <span className="bg-ink-900 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-white">
          Create account
        </span>
      </div>
    </div>
  )
}

/* ── Screen 1: the directory ──────────────────────────────────────────────── */

function DirectoryScreen({ query, suggest }: { query: ReactNode; suggest: boolean }) {
  return (
    <>
      <MockBand
        eyebrow="Clubs"
        title="Find a Basketball Club"
        description="Clubs near you, rated by real families. Search by name or city, or browse below."
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        <div className="relative mx-auto max-w-[620px]">
          <div className="flex items-center gap-2">
            <span
              data-demo-target="search-field"
              className="border-ink-200 flex min-h-[42px] flex-1 items-center gap-2.5 rounded-2xl border bg-white px-4 shadow-sm transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-ink-400 h-4 w-4 shrink-0"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="text-[13.5px]">{query}</span>
            </span>
            <MockButton tone="brand">Search</MockButton>
          </div>

          {suggest && (
            <div className="border-ink-200 live-pop absolute left-0 right-[92px] top-full z-30 mt-1.5 overflow-hidden rounded-2xl border bg-white shadow-[0_28px_60px_-24px_rgba(15,23,42,0.45)]">
              {SUGGESTIONS.map((s) => (
                <span
                  key={s.id}
                  data-demo-target={`suggest-${s.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 transition-colors duration-150 motion-reduce:transition-none data-[demo-hover=true]:bg-play-50/70 data-[demo-press=true]:bg-play-100"
                >
                  <Crest name={s.name} size="sm" />
                  <span className="min-w-0">
                    <span className="text-ink-900 block text-[13px] font-semibold">{s.name}</span>
                    <span className="text-ink-400 block text-[11px]">{s.meta}</span>
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <MockChips idPrefix="city" value="all" options={CITIES} />
        </div>

        <p className="text-ink-500 mt-4 text-[11px] font-bold uppercase tracking-[0.14em]">
          Top clubs
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {DIRECTORY.map((c) => (
            <div
              key={c.id}
              className="border-ink-100 rounded-2xl border bg-white px-3 py-2.5 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.6)]"
            >
              <div className="flex items-center gap-2.5">
                <Crest name={c.name} size="md" />
                <span className="min-w-0">
                  <span className="text-ink-900 block truncate text-[13px] font-bold">{c.name}</span>
                  <span className="text-ink-400 block text-[11px]">
                    {c.city} · {c.teams} teams
                  </span>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-gold-500 text-[11px]">
                  {c.open ? <span className="text-ink-300">No reviews yet</span> : "★★★★★ 4.8"}
                </span>
                {c.open && <MockPill tone="neutral">Open profile</MockPill>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Screen 2: the public club page, before and after ─────────────────────── */

function ClubPublicScreen({
  claimed,
  brand,
  logo,
  tagline,
  description,
}: {
  claimed: boolean
  brand: string
  logo: boolean
  tagline: string
  description: string
}) {
  /* The one hex the page is allowed to use, and only once a club has chosen
     it: hasChosenBrand() gates every crest, button and stripe on this screen. */
  const accent = claimed && brand ? brand : ""
  const style = accent ? ({ ["--brand"]: accent } as CSSProperties) : undefined

  return (
    <div className="flex h-full flex-col" style={style}>
      <div className="relative isolate overflow-hidden border-b border-[#e7dbc4]">
        <CourtBackdropLayer variant="daylight" intensity="band" />
        <div className="relative z-10 px-7 pb-5 pt-5">
          <p className="text-ink-400 text-[11px] font-semibold">‹ Clubs</p>
          <div className="mt-2 flex items-start gap-4">
            {logo ? (
              <UploadedCrest brand={accent} />
            ) : (
              <Crest
                name={CLUB}
                size="xl"
                brandColor={accent || null}
                sizeClassName="h-[68px] w-[68px] rounded-2xl text-[22px]"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-ink-900 text-[30px] font-bold leading-tight tracking-tight">
                {CLUB}
              </h1>
              {tagline && (
                <p className="text-ink-600 live-row-in mt-0.5 text-[13.5px] font-semibold">
                  {tagline}
                </p>
              )}
              <span className="border-ink-200 text-ink-600 mt-1.5 inline-flex items-center gap-1 rounded-full border bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3 w-3"
                >
                  <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {CITY}
              </span>
              {description ? (
                <p className="text-ink-700 live-row-in mt-2 max-w-[620px] text-[13px] leading-relaxed">
                  {description}
                </p>
              ) : (
                <p className="text-ink-400 mt-2 max-w-[620px] text-[13px] italic leading-relaxed">
                  This club hasn&apos;t written an introduction yet.
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <MockButton tone={accent ? "brand" : "quiet"}>View programs</MockButton>
                <MockButton tone="quiet">Contact</MockButton>
                {claimed ? (
                  <MockButton tone="quiet" icon={<span className="text-[13px]">＋</span>}>
                    Follow
                  </MockButton>
                ) : (
                  <span
                    data-demo-target="claim-cta"
                    className="bg-ink-950 inline-flex select-none items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:-translate-y-[1px] data-[demo-hover=true]:shadow-lg data-[demo-press=true]:translate-y-0 data-[demo-press=true]:scale-[0.97]"
                  >
                    Claim this club
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2.5">
            <MockTile compact label="Teams" value="6" />
            <MockTile compact label="Open programs" value={claimed ? "2" : "0"} />
            <MockTile
              compact
              label="Next game"
              value={<span className="text-[15px]">{claimed ? "Sat 9:00 AM" : "TBD"}</span>}
            />
            <MockTile
              compact
              label={claimed ? "Rating" : "Staff"}
              value={<span className="text-[15px]">{claimed ? "New" : "0"}</span>}
            />
          </div>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 transition-colors duration-500 motion-reduce:transition-none"
          style={{ backgroundColor: accent || "#0f1b33" }}
        />
      </div>

      <div className="border-ink-100 flex shrink-0 items-center gap-1 border-b bg-white px-7 py-2">
        {["About", "Teams", "Programs", "Schedule", "Contact"].map((t) => (
          <span
            key={t}
            className={
              t === "About"
                ? "text-ink-900 border-b-2 border-[color:var(--brand,#0f1b33)] px-2.5 py-1 text-[12.5px] font-bold"
                : "text-ink-500 px-2.5 py-1 text-[12.5px] font-semibold"
            }
          >
            {t}
          </span>
        ))}
      </div>

      <div className="bg-ink-50/60 min-h-0 flex-1 px-7 py-4">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
          <div className="border-ink-100 rounded-2xl border bg-white px-4 py-3">
            <p className="text-ink-500 text-[11px] font-bold uppercase tracking-[0.12em]">Teams</p>
            <div className="mt-2 space-y-1.5">
              {["U11 Girls Rep", "U13 Boys Rep", "U13 Girls Rep", "U16 Boys Rep"].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <Crest name={t} size="xs" brandColor={accent || null} />
                  <span className="text-ink-800 text-[12.5px] font-semibold">{t}</span>
                  <span className="text-ink-400 ml-auto text-[11px]">Fall 2026</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-ink-100 rounded-2xl border bg-white px-4 py-3">
            <p className="text-ink-500 text-[11px] font-bold uppercase tracking-[0.12em]">Contact</p>
            <p className="text-ink-700 mt-2 text-[12.5px] font-semibold">
              {claimed ? "info@riversideravens.ca" : "From the league listing"}
            </p>
            <p className="text-ink-400 mt-0.5 text-[11.5px]">
              {claimed ? "Answered by the club" : "Nobody at the club manages this page yet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The mark a club uploads. It wins over the monogram, on every surface. */
function UploadedCrest({ brand }: { brand: string }) {
  return (
    <span
      className="live-pop flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl shadow-sm"
      style={{ backgroundColor: brand || "#0f1b33" }}
    >
      <svg viewBox="0 0 64 64" className="h-[52px] w-[52px]" aria-hidden="true">
        <path
          d="M32 6l22 8v18c0 14-9.5 22.5-22 26C19.5 54.5 10 46 10 32V14z"
          fill="none"
          stroke={SECONDARY}
          strokeWidth="3"
        />
        <path
          d="M20 30c6-6 12-8 18-6-3 5-3 9-1 13-5 3-11 2-17-7z"
          fill={SECONDARY}
          opacity="0.95"
        />
        <text
          x="32"
          y="47"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="12"
          fontWeight="800"
          fontFamily="system-ui"
        >
          RR
        </text>
      </svg>
    </span>
  )
}

/* ── Screen 3: the claim wizard ───────────────────────────────────────────── */

function ClaimScreen({ step, code }: { step: string; code: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6">
      <CourtBackdropLayer variant="daylight" intensity="band" />
      <div className="border-ink-100 live-pop relative z-10 w-full max-w-[520px] rounded-[28px] border bg-white px-7 py-6 shadow-[0_40px_100px_-50px_rgba(15,23,42,0.6)]">
        <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.16em]">
          {step === "claimed" ? "Take ownership" : "Claim your club"}
        </p>
        <h1 className="text-ink-900 mt-1 text-[24px] font-bold leading-tight tracking-tight">
          {CLUB}
        </h1>
        <p className="text-ink-500 text-[12.5px]">Toronto, Ontario</p>

        <div key={step} className="demo-fade-in mt-4">
          {step === "options" && <ClaimOptions />}
          {step === "code" && <ClaimCode code={code} />}
          {step === "verified" && <ClaimVerified />}
          {step === "claimed" && <ClaimDone />}
        </div>
      </div>
    </div>
  )
}

function ClaimOptions() {
  return (
    <>
      <p className="text-ink-600 text-[13px] leading-relaxed">
        To prove you run this club, we send a code to the contact info already on file. No account
        needed yet.
      </p>
      <div className="mt-3 space-y-2">
        <ChannelButton
          id="channel-email"
          icon="✉"
          label={`Email a code to ${MASKED_EMAIL}`}
          selected
        />
        <ChannelButton id="channel-sms" icon="☎" label={`Text a code to ${MASKED_PHONE}`} />
        <ChannelButton
          id="channel-proof"
          icon="⎘"
          label="I can't access those, submit proof instead"
          hint="Describe your proof (website admin, registration papers, social account) and an admin will review it."
        />
      </div>
      <span
        data-demo-target="corrections"
        className="text-play-600 mt-3 inline-block text-[12px] font-semibold underline decoration-dotted underline-offset-4 transition-colors duration-200 motion-reduce:transition-none data-[demo-hover=true]:text-play-700"
      >
        Our info looks wrong? Propose corrections
      </span>
      <div className="mt-4">
        <MockButton id="send-code" className="w-full justify-center">
          Send the code
        </MockButton>
      </div>
    </>
  )
}

function ChannelButton({
  id,
  icon,
  label,
  hint,
  selected,
}: {
  id: string
  icon: string
  label: string
  hint?: string
  selected?: boolean
}) {
  return (
    <span
      data-demo-target={id}
      className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition-all duration-200 motion-reduce:transition-none ${
        selected ? "border-play-500 bg-play-50/60" : "border-ink-200 bg-white"
      } data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2 data-[demo-press=true]:scale-[0.99]`}
    >
      <span className="bg-ink-100 text-ink-600 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[12px]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block text-[12.5px] font-semibold">{label}</span>
        {hint && <span className="text-ink-400 mt-0.5 block text-[11px] leading-snug">{hint}</span>}
      </span>
      {selected && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          className="mt-1 h-3.5 w-3.5 shrink-0"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  )
}

function ClaimCode({ code }: { code: ReactNode }) {
  return (
    <>
      <p className="text-ink-600 text-[13px] leading-relaxed">
        We sent a 6-digit code to {MASKED_EMAIL}. It expires in 30 minutes.
      </p>
      <span
        data-demo-target="code-input"
        className="border-ink-200 mt-4 flex h-[54px] w-full items-center justify-center rounded-2xl border bg-white text-center font-mono text-[26px] font-bold tracking-[0.42em] transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
      >
        {code}
      </span>
      <div className="mt-4">
        <MockButton id="verify" className="w-full justify-center">
          Verify
        </MockButton>
      </div>
      <p className="text-ink-400 mt-2 text-center text-[11px]">
        Five tries, then the code is retired and a new one has to be sent.
      </p>
    </>
  )
}

function ClaimVerified() {
  return (
    <>
      <MockPill tone="court">Verified</MockPill>
      <p className="text-ink-700 mt-2.5 text-[13px] leading-relaxed">
        {CLUB} is reserved for you for 14 days. Create an account (any email works) or sign in. The
        club binds to your account, not the inbox that got the code.
      </p>
      <div className="mt-4">
        <MockButton id="take-ownership" className="w-full justify-center">
          Take ownership
        </MockButton>
      </div>
      <p className="text-ink-400 mt-2 text-center text-[11px]">
        We also emailed this link to the verified contact.
      </p>
    </>
  )
}

function ClaimDone() {
  return (
    <>
      <span className="bg-court-600 live-pop mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-6 w-6">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div className="mt-3 text-center">
        <MockPill tone="court">Club claimed</MockPill>
        <p className="text-ink-700 mt-2.5 text-[13px] leading-relaxed">
          You&apos;re the owner. Everything about the club is now yours to edit.
        </p>
        <div className="mt-4">
          <MockButton className="w-full justify-center">Go to your club dashboard</MockButton>
        </div>
      </div>
    </>
  )
}

/* ── Screen 4: the branding surface ───────────────────────────────────────── */

function CustomizeScreen({
  brand,
  secondary,
  logo,
  tagline,
  description,
}: {
  brand: string
  secondary: string
  logo: boolean
  tagline: ReactNode
  description: ReactNode
}) {
  return (
    <>
      <MockBand
        eyebrow="Club workspace"
        title="Customize your public page"
        description="Brand it, add your info, and arrange the sections. Changes go live when you save."
        action={<MockButton tone="quiet">View public page ↗</MockButton>}
      />
      <div className="bg-ink-50/60 flex min-h-0 flex-1 flex-col px-6 py-3">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
          <section className="border-ink-100 rounded-2xl border bg-white px-4 py-2.5 shadow-[0_10px_30px_-26px_rgba(15,23,42,0.55)]">
            <h2 className="text-ink-900 text-[15px] font-bold">Brand</h2>
            <p className="text-ink-400 text-[11.5px] leading-snug">
              Your banner, logo, colors, and the words at the top of the page.
            </p>

            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_112px] gap-3">
              <div>
                <p className="text-ink-600 mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
                  Banner image
                </p>
                <div className="border-ink-200 bg-ink-50 text-ink-400 flex h-[46px] items-center justify-center rounded-xl border text-[11.5px]">
                  No image
                </div>
                <p className="text-ink-400 mt-1 text-[10.5px]">
                  Wide hero image. No image = a gradient in your primary color.
                </p>
              </div>
              <div>
                <p className="text-ink-600 mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
                  Logo
                </p>
                {logo ? (
                  <div className="live-pop border-ink-200 flex h-[46px] items-center justify-center rounded-xl border bg-white">
                    <UploadedCrestSmall brand={brand} />
                  </div>
                ) : (
                  <div className="border-ink-200 bg-ink-50 text-ink-400 flex h-[46px] items-center justify-center rounded-xl border text-[11.5px]">
                    No image
                  </div>
                )}
                <div className="mt-1">
                  <MockButton id="logo-upload" tone="quiet" size="sm">
                    {logo ? "Replace" : "Upload"}
                  </MockButton>
                </div>
              </div>
            </div>

            <div className="mt-2">
              <MockField id="field-tagline" label="Tagline">
                {tagline}
              </MockField>
            </div>

            <div className="mt-2">
              <MockTextArea id="field-description" label="Description" rows={2}>
                {description}
              </MockTextArea>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <Swatch id="swatch-primary" label="Primary color" value={brand} />
              <Swatch id="swatch-secondary" label="Secondary color" value={secondary} />
              <Swatch label="Accent color" value="" />
            </div>
          </section>

          <div className="space-y-2.5">
            <QuietCard title="Contact info" hint="Shown in the Contact section. Leave blanks empty and they won't appear." />
            <QuietCard title="Follow us" hint="Your social handles or full URLs." />
            <QuietCard
              title="Page layout"
              hint="Drag to reorder within a column, and toggle what's visible."
            />
            <QuietCard title="Announcements" hint="Short updates that show in your Announcements block." />
          </div>
        </div>

        <div className="border-ink-100 mt-2.5 flex shrink-0 items-center gap-3 rounded-2xl border bg-white px-4 py-2.5 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.5)]">
          <p className="text-ink-400 text-[11.5px] font-medium">
            Nothing is public until you save.
          </p>
          <span className="ml-auto">
            <MockButton id="save-changes">Save changes</MockButton>
          </span>
        </div>
      </div>
    </>
  )
}

/** The native colour swatch beside its hex, the pair the settings page draws. */
function Swatch({ id, label, value }: { id?: string; label: string; value: string }) {
  const empty = !value
  return (
    <div>
      <p className="text-ink-600 mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
        {label}
      </p>
      <span
        data-demo-target={id}
        className="border-ink-200 flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2 data-[demo-press=true]:scale-[0.98]"
      >
        <span
          className="border-ink-200 h-6 w-6 shrink-0 rounded-md border transition-colors duration-500 motion-reduce:transition-none"
          style={{ backgroundColor: value || "#ffffff" }}
        />
        <span
          className={`text-[11.5px] font-semibold tabular-nums ${empty ? "text-ink-300" : "text-ink-800"}`}
        >
          {value || "#1a73e8"}
        </span>
      </span>
    </div>
  )
}

function QuietCard({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="border-ink-100 rounded-2xl border bg-white px-3.5 py-2.5">
      <h2 className="text-ink-900 text-[13px] font-bold">{title}</h2>
      <p className="text-ink-400 mt-0.5 text-[11px] leading-snug">{hint}</p>
    </section>
  )
}

function UploadedCrestSmall({ brand }: { brand: string }) {
  return (
    <span
      className="flex h-[40px] w-[40px] items-center justify-center rounded-lg"
      style={{ backgroundColor: brand || "#0f1b33" }}
    >
      <svg viewBox="0 0 64 64" className="h-[32px] w-[32px]" aria-hidden="true">
        <path
          d="M32 6l22 8v18c0 14-9.5 22.5-22 26C19.5 54.5 10 46 10 32V14z"
          fill="none"
          stroke={SECONDARY}
          strokeWidth="3"
        />
        <path d="M20 30c6-6 12-8 18-6-3 5-3 9-1 13-5 3-11 2-17-7z" fill={SECONDARY} />
      </svg>
    </span>
  )
}
