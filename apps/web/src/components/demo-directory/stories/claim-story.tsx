"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, Panel, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Claim your club and make it yours", rebuilt 2026-08-16 to the gold standard
 * set by the season story, the schedule-change demo, the waivers demo, game
 * day, the referees demo, the roster story, the money picture, the loop story
 * and your week.
 *
 * THE CLUB IS REAL AND SO IS ITS LISTING. `DB` `Tenant fb71b08a`, "Alpha Elite
 * Sports Group", UNCLAIMED, published 2026-08-15, `dataSources`
 * "contact-enrichment,geocode,ontario-circuit-list,website-scrape". It is one
 * of **1,325 published unclaimed listings** in this database, imported by
 * `scripts/import-clubs.ts` from the Canadian club census. Its city reads
 * "Toronto ON" with the province stuck on the end, its phone is ten unbroken
 * digits and its website has no scheme, which is what an imported listing
 * really looks like and exactly why the flow has a corrections step.
 *
 * THE FLOW IS CLAIM-V2, VERBATIM. `lib/claims/claim-v2.ts` documents itself:
 *
 *   anonymous claim → code to the club's contact ON FILE (census data)
 *   → verify → completion token + ~14-day reservation
 *   → register/sign in with the token → claim binds to the User
 *   → club CLAIMED (ClubOwner role), claim-time corrections applied.
 *
 * Every constant on screen is that module's: `CODE_TTL_MINUTES` 30,
 * `CODE_ATTEMPT_CAP` 5, `RESERVATION_DAYS` 14. Every masked hint is
 * `maskEmail`/`maskPhone` from `lib/sms.ts`, run for real against this club's
 * own row rather than typed by hand.
 *
 * ONE IDENTITY LAW, AND WHY THIS DOES NOT BREAK IT. Claiming is PRE-IDENTITY:
 * the wizard is anonymous, and proof of control is that the code lands at the
 * contact already on file, never at an address the claimer types. Ownership
 * binds at the END, to whichever signed-in `User` redeems the token, and the
 * product says so in its own words: "the club binds to your account, not the
 * inbox that got the code". So there is no second identity anywhere in the
 * flow. Written up in `docs/roadmap/claim-numbers.md` section 0.
 *
 * TWO THINGS THE DEMO DOES NOT PRETEND ABOUT (numbers sheet section F):
 *   1. THE TEXT CHANNEL IS NOT AVAILABLE ON THIS MACHINE. `smsEnabled()`
 *      requires three Twilio variables and none is set, so the wizard renders
 *      the email option and the proof option and nothing else. The demo shows
 *      the two it really renders.
 *   2. A CLAIMED CLUB IS STILL NAVY UNTIL SOMEBODY PICKS A COLOUR.
 *      `hasChosenBrand()` refuses the schema default, so the branding chapter
 *      is not decoration, it is the step that turns the colour on at all.
 */

/* ── The listing, read out of the seeded world ───────────────────────────── */

const CLUB = "Alpha Elite Sports Group"
const CITY = "Toronto ON"
const CITY_FIXED = "Toronto"
const WEBSITE = "alphaelitesportsgroup.com"
const WEBSITE_FIXED = "https://alphaelitesportsgroup.com"
const PHONE = "6476189295"
const PHONE_FIXED = "647-618-9295"

/** `PRODUCT` `maskEmail`/`maskPhone` in `lib/sms.ts`, run against this row. */
const MASKED_EMAIL = "co•••@alphaelitesportsgroup.com"
const MASKED_PHONE = "64••••9295"

/** `DB` published unclaimed listings, and how contactable they are. */
const UNCLAIMED_TOTAL = 1325
const WITH_EMAIL = 1003
const PHONE_ONLY = 94

/**
 * The page of the directory a visitor lands on before searching. `DB` the
 * first fifteen UNCLAIMED tenants in name order, exactly as the directory
 * sorts and renders them.
 *
 * The 2026-08-16 cut drew three cards here and three after the search, with
 * about 300px of empty page under both. A directory that says it holds 1,325
 * listings shows a page of them.
 */
const BROWSE = [
  { name: "1 of 1", city: "Ontario" },
  { name: "17 Basketball Club", city: "Richmond Hill" },
  { name: "17 Ignite", city: "Ontario" },
  { name: "1K Elite", city: "Ontario" },
  { name: "2 Way Elite", city: "Ontario" },
  { name: "204 Elite Basketball Club", city: "Winnipeg" },
  { name: "22 Wing Fitness & Wellness Centre", city: "Hornell Heights" },
  { name: "3 Point Basketball", city: "North Vancouver" },
  { name: "306 Heat", city: "Regina" },
  { name: "360BTG (Basketball & Soccer)", city: "Oshawa/Whitby/Ajax" },
  { name: "3D Basketball Academy", city: "North Vancouver" },
  { name: "416 United", city: "Toronto" },
  { name: "4th Qtr Basketball", city: "Ontario" },
  { name: "506 Elevate Basketball", city: "Moncton" },
  { name: "780 Basketball Club", city: "Edmonton" },
]
const NEITHER = 228

/** `PRODUCT` `lib/claims/claim-v2.ts` lines 21 to 23. */
const CODE_TTL = 30
const ATTEMPT_CAP = 5
const RESERVATION_DAYS = 14
const CODE = "418305"

/** `PRODUCT` the wizard's own sentences, `claim-wizard.tsx`. */
const WIZARD_INTRO =
  "To prove you run this club, we send a code to the contact info already on file · no account needed yet."
const CORRECTIONS_TOGGLE = "Our info looks wrong? Propose corrections"
const CORRECTIONS_HINT = "Corrections apply when the claim completes."
const CODE_SENT = `We sent a 6-digit code to ${MASKED_EMAIL}. It expires in ${CODE_TTL} minutes.`
const RESERVED = `${CLUB} is reserved for you for ${RESERVATION_DAYS} days. Create an account (any email works) or sign in · the club binds to your account, not the inbox that got the code.`
const ALSO_EMAILED = "We also emailed this link to the verified contact."
const OWNED = "You're the owner. Everything about the club is now yours to edit."

/** `PRODUCT` `clubs/[id]/customize/page.tsx` lines 59 to 61. */
const CUSTOMIZE_TITLE = "Customize your public page"
const CUSTOMIZE_SUB = "Brand it, add your info, and arrange the sections. Changes go live when you save."
const BRAND_HINT = "Your banner, logo, colors, and the words at the top of the page."
const TAGLINE = "Developing players since 2009"
const SAVED = "Saved · your public page is updated."
/** `PRODUCT` `lib/club-page/brand.ts`: the schema default it refuses. */
const DEFAULT_HEX = "#1a73e8"
const CHOSEN_HEX = "#7c3aed"

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const claimStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/club",
  context: "SportsHub · Club directory",
  initialStage: "desktop",
  chapters: [
    { id: "find", title: "Find your club" },
    { id: "prove", title: "Prove it" },
    { id: "reserved", title: "Reserved for you" },
    { id: "brand", title: "Make it yours" },
  ],

  beats: [
    /* ── 1. Find your club ────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "find",
      caption: "The directory already holds a listing for most Canadian clubs.",
      emphasize: "dir-count",
      callout:
        "Over thirteen hundred Canadian clubs are already listed, built from public league data.",
    }),
    paced({
      id: "search",
      chapter: "find",
      caption: "The first step is finding yours.",
      cursor: "search",
      type: { key: "q", text: "Alpha Elite" },
      set: { searched: true },
      callout: "The search reads name and city, so either one finds a listing.",
    }),
    paced({
      id: "row",
      chapter: "find",
      caption: "The listing is a public page about the club.",
      emphasize: "result",
      callout: "It is published and readable now, and nobody at the club runs it.",
    }),
    paced({
      id: "page",
      chapter: "find",
      caption: "Opening it shows what an imported listing looks like.",
      cursor: "result",
      press: true,
      set: { view: "page" },
      context: `${CLUB} · public page`,
      callout: "The province is stuck on the end of the city, and the colour is the import default.",
    }),
    paced({
      id: "claim-btn",
      chapter: "find",
      caption: "That button.",
      cursor: "claim-btn",
      press: true,
      set: { view: "wizard" },
      context: `${CLUB} · claim`,
      callout: "No account yet. The claim starts before anybody signs up for anything.",
    }),

    /* ── 2. Prove it ──────────────────────────────────────────────────── */
    paced({
      id: "channels",
      chapter: "prove",
      caption: "The claim starts with a code.",
      emphasize: "intro",
      callout: "It goes to the contact already on file, so the destination is not a choice.",
    }),
    paced({
      id: "masked",
      chapter: "prove",
      caption: "Masked, so the page cannot be used to harvest an address either.",
      emphasize: "channel-email",
      callout: "Enough of the address to recognise, and not enough to write down.",
    }),
    paced({
      id: "corrections",
      chapter: "prove",
      caption: "Beside it, the corrections.",
      cursor: "corrections-toggle",
      press: true,
      set: { corrections: true },
      callout: "Corrections are collected now and applied when the claim completes.",
    }),
    paced({
      id: "fix",
      chapter: "prove",
      caption: "This listing is wrong in three places.",
      emphasize: "corrections-fields",
      callout: "The province stuck on the city, an unformatted phone, a website with no scheme.",
    }),
    paced({
      id: "send",
      chapter: "prove",
      caption: "Send the code.",
      cursor: "send-code",
      press: true,
      set: { view: "code" },
      callout: "It goes to the club's own inbox, whoever is filling this in.",
    }),
    paced({
      id: "expiry",
      chapter: "prove",
      caption: "Six digits, on a clock.",
      emphasize: "code-note",
      callout: "Thirty minutes, five attempts, and then the claim expires and starts again.",
    }),
    paced({
      id: "verify",
      chapter: "prove",
      caption: "Verified.",
      cursor: "code-field",
      type: { key: "code", text: CODE },
      set: { verified: true },
      callout: "The code proves the inbox, which is all it is asked to prove.",
    }),

    /* ── 3. Reserved for you ──────────────────────────────────────────── */
    paced({
      id: "reserved",
      chapter: "reserved",
      caption: "Verified is not the same as owned.",
      set: { view: "verified" },
      emphasize: "reserved-card",
      callout: "Reserved for fourteen days while you decide what account to run it from.",
    }),
    paced({
      id: "identity",
      chapter: "reserved",
      caption: "The club binds to an account, and the account is a person.",
      emphasize: "identity-line",
      callout: "The inbox that received the code is not the thing that ends up owning the club.",
    }),
    paced({
      id: "take",
      chapter: "reserved",
      caption: "Take ownership, with any email you like.",
      cursor: "take-btn",
      press: true,
      set: { view: "owned" },
      toast: `Club claimed · ${CLUB}`,
      callout: "Create an account or sign in. This is the first time the flow asks for one.",
    }),
    paced({
      id: "writes",
      chapter: "reserved",
      caption: "One press does four things, in one transaction.",
      emphasize: "writes-card",
      callout:
        "The listing goes active, your corrections are applied, you become the owner, and the whole thing is audited.",
    }),

    /* ── 4. Make it yours ─────────────────────────────────────────────── */
    paced({
      id: "customize",
      chapter: "brand",
      caption: "The page is now a page the club runs.",
      set: { view: "customize" },
      context: `${CLUB} · customize`,
      emphasize: "brand-panel",
      callout: "Banner, crest, colours and the words at the top, on one screen.",
    }),
    paced({
      id: "colour",
      chapter: "brand",
      caption: "Pick a colour.",
      cursor: "colour-field",
      press: true,
      set: { colour: true },
      callout: "The page stays unpainted until somebody picks one, so the import default never ships.",
    }),
    paced({
      id: "words",
      chapter: "brand",
      caption: "Then your own words.",
      cursor: "tagline-field",
      type: { key: "tagline", text: TAGLINE },
      set: { words: true },
      callout: "A tagline and a paragraph, both on the public page.",
    }),
    paced({
      id: "save",
      chapter: "brand",
      caption: "Save.",
      cursor: "save-btn",
      press: true,
      toast: SAVED,
      set: { saved: true },
      callout: "It reaches the public page as soon as it is saved.",
    }),
    paced({
      id: "public",
      chapter: "brand",
      caption: "The same page, an afternoon later.",
      set: { view: "page", claimed: true },
      context: `${CLUB} · public page`,
      emphasize: "hero",
      callout: "The claim button is gone, because the club is claimed.",
    }),
    paced({
      id: "end",
      chapter: "brand",
      caption:
        "A listing the club did not make, claimed with a code sent to the contact on file, corrected on the way in, and turned into the club's own page the same afternoon.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const view = get<string>("view", "directory")
    return {
      desktop: (
        <div className="relative flex h-full flex-col">
          <div key={view} className="demo-fade-in flex min-h-0 flex-1 flex-col">
            {view === "directory" && (
              <Directory q={get<string>("q", "")} typing={typingKey === "q"} searched={get("searched", false)} />
            )}
            {view === "page" && <PublicPage claimed={get("claimed", false)} />}
            {view === "wizard" && <Wizard corrections={get("corrections", false)} />}
            {view === "code" && (
              <CodeStep code={get<string>("code", "")} typing={typingKey === "code"} verified={get("verified", false)} />
            )}
            {view === "verified" && <Verified />}
            {view === "owned" && <Owned />}
            {view === "customize" && (
              <Customize
                colour={get("colour", false)}
                tagline={get<string>("tagline", "")}
                typing={typingKey === "tagline"}
                saved={get("saved", false)}
              />
            )}
          </div>
          {get("endCard", false) && <EndCard />}
        </div>
      ),
    }
  },
}

/* ── 1. The directory ────────────────────────────────────────────────────── */

function Directory({ q, typing, searched }: { q: string; typing: boolean; searched: boolean }) {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-8 py-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-display text-ink-900 text-[26px] font-extrabold">Club directory</h2>
        <span data-demo-target="dir-count" className="text-ink-600 text-[16px] font-semibold">
          <span className="text-play-700 text-[20px] font-extrabold tabular-nums">
            {UNCLAIMED_TOTAL.toLocaleString("en-CA")}
          </span>{" "}
          published listings nobody has claimed yet
        </span>
      </div>

      <span
        data-demo-target="search"
        className={cn(
          "border-ink-300 mt-4 flex w-[460px] items-center gap-2 rounded-xl border bg-white px-4 py-2 text-[16px] font-semibold",
          q ? "text-ink-900" : "text-ink-400"
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {q || "Search clubs by name or city"}
        {typing && <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />}
      </span>

      <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-2">
        {searched ? (
          <>
            <ClubCard
              id="result"
              name={CLUB}
              city={CITY}
              unclaimed
              fresh
            />
            <ClubCard name="Alpha Elite Basketball Academy" city="Ottawa" unclaimed fresh />
            <ClubCard name="Alpha Prep" city="Hamilton" unclaimed fresh />
          </>
        ) : (
          BROWSE.map((c) => <ClubCard key={c.name} name={c.name} city={c.city} unclaimed />)
        )}
      </div>
    </div>
  )
}

function ClubCard({
  name,
  city,
  unclaimed,
  id,
  fresh,
}: {
  name: string
  city: string
  unclaimed?: boolean
  id?: string
  fresh?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "border-ink-200 flex items-center gap-3 rounded-2xl border bg-white px-4 py-3",
        fresh && "live-row-in"
      )}
    >
      <span
        aria-hidden="true"
        className="bg-ink-900 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold text-white"
      >
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="text-ink-900 block truncate text-[16px] font-bold">{name}</span>
        <span className="text-ink-500 block truncate text-[14px] font-medium">{city}</span>
      </span>
      {unclaimed && (
        <span className="ml-auto shrink-0">
          <Chip tone="neutral">Open profile</Chip>
        </span>
      )}
    </div>
  )
}

/* ── The public page ─────────────────────────────────────────────────────── */

function PublicPage({ claimed }: { claimed: boolean }) {
  return (
    <div className="min-h-0 flex-1 bg-white">
      <div
        data-demo-target="hero"
        className="relative px-8 pb-6 pt-6"
        style={{
          background: claimed
            ? `linear-gradient(120deg, ${CHOSEN_HEX}22, #ffffff 65%)`
            : "linear-gradient(120deg, #0f1b3311, #ffffff 65%)",
        }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-[24px] font-extrabold text-white"
            style={{ background: claimed ? CHOSEN_HEX : "#0f1b33" }}
          >
            A
          </span>
          <span className="min-w-0">
            <h2 className="font-display text-ink-900 text-[26px] font-extrabold leading-tight">
              {CLUB}
            </h2>
            <p className="text-ink-500 text-[16px] font-semibold">
              {claimed ? CITY_FIXED : CITY}
            </p>
            {claimed && (
              <p className="text-ink-700 live-pop mt-1.5 text-[16px] font-semibold">{TAGLINE}</p>
            )}
          </span>
          <span className="ml-auto shrink-0">
            {claimed ? (
              <Btn tone="quiet" size="sm">
                Follow
              </Btn>
            ) : (
              <span data-demo-target="claim-btn">
                <Btn tone="primary">Claim this club</Btn>
              </span>
            )}
          </span>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ background: claimed ? CHOSEN_HEX : "#0f1b33" }}
        />
      </div>

      <div className="px-8 py-4">
        <div className="grid grid-cols-3 gap-3">
          <Fact label="City" value={claimed ? CITY_FIXED : CITY} fixed={claimed} />
          <Fact label="Website" value={claimed ? WEBSITE_FIXED : WEBSITE} fixed={claimed} />
          <Fact label="Phone" value={claimed ? PHONE_FIXED : PHONE} fixed={claimed} />
        </div>
        <p className="text-ink-500 mt-3 text-[15px] font-medium leading-snug">
          {claimed
            ? "Claimed, corrected, and branded. The colour on this page is one a human chose."
            : "Built from public league listings. The colour is the platform's, not the club's, and there is nothing here the club put on it."}
        </p>
      </div>
    </div>
  )
}

function Fact({ label, value, fixed }: { label: string; value: string; fixed?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-2",
        fixed ? "border-court-200 bg-court-50/60" : "border-ink-200 bg-white"
      )}
    >
      <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">{label}</p>
      <p className="text-ink-900 mt-0.5 truncate text-[16px] font-bold">{value}</p>
    </div>
  )
}

/* ── 2. The wizard ───────────────────────────────────────────────────────── */

function Wizard({ corrections }: { corrections: boolean }) {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-8 py-4">
      <div className="mx-auto w-[620px]">
        <p className="text-play-700 text-[14px] font-bold uppercase tracking-[0.12em]">
          Claim your club
        </p>
        <h2 className="font-display text-ink-900 mt-1 text-[26px] font-extrabold">{CLUB}</h2>
        <p className="text-ink-500 text-[16px] font-semibold">{CITY}</p>

        <p data-demo-target="intro" className="text-ink-700 mt-2 text-[16px] font-medium leading-snug">
          {WIZARD_INTRO}
        </p>

        <div className="mt-2 space-y-1.5">
          <Channel
            id="channel-email"
            label={`Email a code to ${MASKED_EMAIL}`}
            selected
          />
          <Channel label="I can't access those · submit proof instead" />
          <p className="text-ink-500 px-1 text-[14px] font-medium leading-snug">
            Describe your proof (website admin, registration papers, social account) and an admin
            will review it.
          </p>
        </div>

        <p
          data-demo-target="corrections-toggle"
          className={cn(
            "mt-2.5 text-[15px] font-bold",
            corrections ? "text-ink-600" : "text-play-700"
          )}
        >
          {corrections ? "Hide corrections" : CORRECTIONS_TOGGLE}
        </p>

        {corrections && (
          <div data-demo-target="corrections-fields" className="live-pop mt-2 space-y-1.5">
            <Correction label="City" was={CITY} now={CITY_FIXED} />
            <Correction label="Phone" was={PHONE} now={PHONE_FIXED} />
            <Correction label="Website" was={WEBSITE} now={WEBSITE_FIXED} />
            <p className="text-ink-500 px-1 text-[14px] font-medium">{CORRECTIONS_HINT}</p>
          </div>
        )}

        <div className="mt-3">
          <Btn id="send-code">Send the code</Btn>
        </div>
      </div>
    </div>
  )
}

function Channel({ label, selected, id }: { label: string; selected?: boolean; id?: string }) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-white px-4 py-2.5",
        selected ? "border-play-500" : "border-ink-200"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 rounded-full border-[5px]",
          selected ? "border-play-600 bg-white" : "border-ink-200 bg-white"
        )}
      />
      <span className="text-ink-900 text-[16px] font-semibold">{label}</span>
    </div>
  )
}

function Correction({ label, was, now }: { label: string; was: string; now: string }) {
  return (
    <div className="border-ink-200 flex items-center gap-3 rounded-xl border bg-white px-4 py-2">
      <span className="text-ink-600 w-[80px] shrink-0 text-[15px] font-semibold">{label}</span>
      <span className="text-ink-400 text-[15px] font-medium line-through">{was}</span>
      <span className="text-ink-300 text-[14px]" aria-hidden="true">
        →
      </span>
      <span className="text-court-700 text-[15px] font-bold">{now}</span>
    </div>
  )
}

/* ── The code step ───────────────────────────────────────────────────────── */

function CodeStep({
  code,
  typing,
  verified,
}: {
  code: string
  typing: boolean
  verified: boolean
}) {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-8 py-5">
      <div className="mx-auto w-[620px]">
        <p className="text-play-700 text-[14px] font-bold uppercase tracking-[0.12em]">
          Claim your club
        </p>
        <h2 className="font-display text-ink-900 mt-1 text-[26px] font-extrabold">{CLUB}</h2>

        <p data-demo-target="code-note" className="text-ink-700 mt-3 text-[16px] font-medium leading-snug">
          {CODE_SENT}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <span
            data-demo-target="code-field"
            className={cn(
              "border-ink-300 w-[220px] rounded-xl border bg-white px-4 py-2.5 text-center text-[24px] font-extrabold tracking-[0.35em] tabular-nums",
              code ? "text-ink-900" : "text-ink-300"
            )}
          >
            {code || "••••••"}
            {typing && <span className="bg-play-600 ml-0.5 inline-block h-5 w-[2px] align-middle" />}
          </span>
          <Btn tone={verified ? "court" : "primary"}>{verified ? "Verified" : "Verify"}</Btn>
        </div>

        <div className="border-ink-200 mt-4 rounded-2xl border bg-white px-4 py-3">
          <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">
            What the code is protecting
          </p>
          <ul className="mt-1.5 space-y-1">
            <Rule text={`It expires in ${CODE_TTL} minutes.`} />
            <Rule text={`${ATTEMPT_CAP} wrong attempts and the claim expires, and you start again.`} />
            <Rule text="It never goes to an address the claimer typed. Only to the one on file." />
          </ul>
        </div>
      </div>
    </div>
  )
}

function Rule({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="bg-play-600 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white"
      >
        ✓
      </span>
      <span className="text-ink-700 text-[15px] font-medium">{text}</span>
    </li>
  )
}

/* ── 3. Reserved ─────────────────────────────────────────────────────────── */

function Verified() {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-8 py-5">
      <div className="mx-auto w-[620px]">
        <StatusChip tone="court">Verified</StatusChip>
        <div
          data-demo-target="reserved-card"
          className="border-court-200 bg-court-50/60 live-pop mt-2 rounded-2xl border px-5 py-4"
        >
          <p data-demo-target="identity-line" className="text-ink-800 text-[17px] font-semibold leading-snug">
            {RESERVED}
          </p>
          <div className="mt-3">
            <Btn id="take-btn" tone="court">
              Take ownership
            </Btn>
          </div>
          <p className="text-ink-500 mt-2 text-[15px] font-medium">{ALSO_EMAILED}</p>
        </div>
        <p className="text-ink-500 mt-3 text-[15px] font-medium leading-snug">
          While it is reserved, nobody else can start a claim on it. If it lapses, the reservation
          expires on its own and the club is claimable again.
        </p>
      </div>
    </div>
  )
}

function Owned() {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-8 py-5">
      <div className="mx-auto w-[680px]">
        <StatusChip tone="court">Club claimed</StatusChip>
        <h2 className="font-display text-ink-900 mt-2 text-[26px] font-extrabold">{CLUB}</h2>
        <p className="text-ink-700 mt-1 text-[17px] font-semibold">{OWNED}</p>

        <Panel className="mt-3" title="What that one press wrote" id="writes-card">
          <div className="space-y-1.5 px-5 py-3">
            <Wrote label="The claim" value="approved, with the time and the reviewer on it" />
            <Wrote label="The listing" value="unclaimed becomes active" />
            <Wrote label="Your corrections" value="city, phone and website, applied now" />
            <Wrote label="You" value="club owner on this club, and nowhere else" />
            <Wrote label="The audit log" value="one entry, so the change has a name against it" />
          </div>
        </Panel>

        <p className="text-ink-500 mt-3 text-[15px] font-medium leading-snug">
          One transaction. If any part of it failed, none of it happened.
        </p>
      </div>
    </div>
  )
}

function Wrote({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 flex items-center gap-3 rounded-xl border bg-white px-4 py-1.5">
      <span className="text-ink-900 w-[150px] shrink-0 text-[15px] font-bold">{label}</span>
      <span className="text-ink-600 text-[15px] font-medium">{value}</span>
    </div>
  )
}

/* ── 4. Branding ─────────────────────────────────────────────────────────── */

function Customize({
  colour,
  tagline,
  typing,
  saved,
}: {
  colour: boolean
  tagline: string
  typing: boolean
  saved: boolean
}) {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-8 py-5">
      <h2 className="font-display text-ink-900 text-[24px] font-extrabold">{CUSTOMIZE_TITLE}</h2>
      <p className="text-ink-500 text-[16px] font-medium">{CUSTOMIZE_SUB}</p>

      <Panel className="mt-3" title="Brand" meta={BRAND_HINT} id="brand-panel">
        <div className="grid grid-cols-[1fr_1fr] gap-4 px-5 py-3">
          <div className="space-y-2">
            <Field label="Primary color">
              <span data-demo-target="colour-field" className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="border-ink-300 h-7 w-10 shrink-0 rounded-lg border"
                  style={{ background: colour ? CHOSEN_HEX : DEFAULT_HEX }}
                />
                <span
                  className={cn(
                    "border-ink-300 rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold tabular-nums",
                    colour ? "text-ink-900" : "text-ink-400"
                  )}
                >
                  {colour ? CHOSEN_HEX : DEFAULT_HEX}
                </span>
                {!colour && (
                  <span className="text-ink-400 text-[14px] font-medium">the schema default</span>
                )}
              </span>
            </Field>
            <Field label="Tagline">
              <span
                data-demo-target="tagline-field"
                className={cn(
                  "border-ink-300 block rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold",
                  tagline ? "text-ink-900" : "text-ink-400"
                )}
              >
                {tagline || "e.g. Developing players since 2009"}
                {typing && <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />}
              </span>
            </Field>
          </div>
          <div className="space-y-2">
            <Field label="Logo">
              <span className="border-ink-300 flex items-center gap-2 rounded-lg border border-dashed bg-white px-3 py-1.5">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px] font-extrabold text-white"
                  style={{ background: colour ? CHOSEN_HEX : "#0f1b33" }}
                >
                  A
                </span>
                <span className="text-ink-500 text-[15px] font-medium">Square, up to 512px</span>
              </span>
            </Field>
            <Field label="Banner image">
              <span className="border-ink-300 block rounded-lg border border-dashed bg-white px-3 py-1.5 text-[15px] font-medium text-ink-500">
                Wide hero image. No image = a gradient in your primary color.
              </span>
            </Field>
          </div>
        </div>
      </Panel>

      {/* The rest of the customize page. `PRODUCT` `club-page-editor.tsx`'s
          "Page layout" section over `LayoutEditor`, with the block labels from
          `lib/club-page/blocks.ts` and its Main and Rail zones. */}
      <Panel
        className="mt-3"
        title="Page layout"
        meta="Drag to reorder within a column, move a block between Main and Rail, and toggle what's visible."
      >
        <div className="grid grid-cols-3 gap-2 px-5 py-3">
          {[
            ["About", true],
            ["Announcements", true],
            ["Open programs", true],
            ["Teams", true],
            ["Schedule & scores", true],
            ["News & highlights", true],
            ["Reviews", false],
            ["Next game", true],
            ["Contact", true],
          ].map(([label, on]) => (
            <span
              key={String(label)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-[15px] font-semibold",
                on ? "border-court-200 bg-court-50/50 text-ink-900" : "border-ink-200 bg-white text-ink-400"
              )}
            >
              {label}
              <span className={cn("text-[14px] font-bold", on ? "text-court-700" : "text-ink-400")}>
                {on ? "Visible" : "Hidden"}
              </span>
            </span>
          ))}
        </div>
      </Panel>

      <div className="mt-3 flex items-center gap-3">
        <Btn id="save-btn" tone="court">
          Save changes
        </Btn>
        {saved && (
          <span className="text-court-700 live-pop text-[15px] font-bold">{SAVED}</span>
        )}
      </div>

    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="block">
      <span className="text-ink-600 mb-1 block text-[14px] font-semibold">{label}</span>
      {children}
    </span>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard(): ReactNode {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[760px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A club chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          Claim your club and make it yours
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          One of thirteen hundred listings nobody has claimed, found by name, claimed with a
          six-digit code that only ever goes to the contact already on file, corrected on the way in,
          reserved for fourteen days while the owner decides which account runs it, and turned into
          the club&apos;s own page the same afternoon.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">Next: build a team</p>
      </div>
    </div>
  )
}
