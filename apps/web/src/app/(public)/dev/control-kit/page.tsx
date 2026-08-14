"use client"

import { useState } from "react"
import { notFound } from "next/navigation"
import {
  BrandCheckbox,
  BrandListbox,
  ChipGroup,
  ChoiceCardGroup,
  CourtBackdrop,
  DateTimePicker,
} from "@/components/ui"

/**
 * DESIGN PREVIEW, not a product surface (2026-08-13).
 *
 * Every brand control in one place so the set can be judged together: the
 * court backdrop in all three variants, the listbox that replaces native
 * selects, chips, choice cards, the checkbox, and the decorated calendar.
 * Nothing here touches the database.
 *
 * Dev-only twice over: `/dev` is a DEV_ONLY_PREFIX in lib/public-paths, so
 * middleware blocks it live, and the page itself refuses to render in
 * production.
 */

const POSITIONS = [
  { value: "PG", label: "Point guard" },
  { value: "SG", label: "Shooting guard" },
  { value: "SF", label: "Small forward" },
  { value: "PF", label: "Power forward" },
  { value: "C", label: "Centre" },
]

const GENDERS = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "coed", label: "Coed" },
]

const SHIRT_SIZES = [
  { value: "ys", label: "Youth small" },
  { value: "ym", label: "Youth medium" },
  { value: "yl", label: "Youth large" },
  { value: "as", label: "Adult small" },
  { value: "am", label: "Adult medium" },
]

const CERT_LEVELS = [
  { value: "l1", label: "Level 1" },
  { value: "l2", label: "Level 2" },
  { value: "l3", label: "Level 3" },
]

/** A long list, the case a chip row cannot cover. */
const VENUES = [
  "Six Park East",
  "Six Park West",
  "Harbour City Community Centre",
  "Lakeside Secondary",
  "Northgate Athletic Club",
  "Ironwood Fieldhouse",
  "Summit Sports Dome",
  "Eastfield Public School",
  "Riverbend Recreation Centre",
  "Maple Court Arena",
  "Glenview Collegiate",
  "Bayside YMCA",
  "Cedar Hill Gymnasium",
  "Westmount Academy",
  "Trinity Park Courts",
  "Highland Community Hall",
  "Fairbank Middle School",
  "Old Mill Athletic Centre",
  "Stonegate Sportsplex",
  "Kingsway Field House",
].map((label, i) => ({ value: `venue-${i + 1}`, label }))

const PAYMENT_PLANS = [
  {
    value: "full",
    title: "Pay the season in full",
    description: "One charge of $640 today. Nothing else to think about.",
    badge: "Most families",
  },
  {
    value: "monthly",
    title: "Four monthly payments",
    description: "$160 today, then the same on the first of the next three months.",
  },
]

export default function ControlKitPreview() {
  if (process.env.NODE_ENV === "production") notFound()

  const [venue, setVenue] = useState("")
  const [size, setSize] = useState("ym")
  const [gender, setGender] = useState("girls")
  const [position, setPosition] = useState("SF")
  const [cert, setCert] = useState("")
  const [plan, setPlan] = useState("full")
  const [waiver, setWaiver] = useState(false)
  const [adult, setAdult] = useState(true)
  const [dob, setDob] = useState("2012-04-18")
  const [tipOff, setTipOff] = useState("2026-11-14T18:30")

  return (
    <main className="bg-ink-50/70 min-h-screen pb-20">
      <header className="border-ink-100 border-b bg-white px-4 py-10">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-ink-400 font-condensed text-[12px] font-black uppercase tracking-[0.2em]">
            Design preview
          </p>
          <h1 className="text-ink-950 mt-1 text-3xl font-black">Control kit</h1>
          <p className="text-ink-600 mt-2 max-w-xl text-[14px] leading-6">
            The brand background and the form controls that replace the browser defaults.
            Everything on this page is live, so click, tab and type through it.
          </p>
        </div>
      </header>

      <div className="mx-auto mt-10 w-full max-w-3xl space-y-10 px-4">
        {/* ── Court backdrop ─────────────────────────────────────────────── */}
        <Section
          title="Court backdrop"
          note="One cropped half court, masked through the middle"
          why="Three variants off one component. The court is drawn once at 150 percent of the box, anchored off the corner and faded where a card sits, so it reads as part of the surface instead of a shape floating on it."
        >
          <div className="space-y-4">
            <CourtBackdrop
              variant="navy"
              className="rounded-3xl"
              contentClassName="flex items-center justify-center px-6 py-14"
            >
              <SampleCard
                tone="dark"
                eyebrow="Navy"
                title="A whole season, already live."
                body="The house standard. Hero panels, welcome surfaces, anything that has to feel like game night."
              />
            </CourtBackdrop>

            <CourtBackdrop
              variant="daylight"
              className="rounded-3xl"
              contentClassName="flex items-center justify-center px-6 py-14"
            >
              <SampleCard
                tone="light"
                eyebrow="Daylight"
                title="Find a club near you."
                body="Warm and open. Signed-out browse pages, marketing, anything a first-time visitor lands on."
              />
            </CourtBackdrop>

            <CourtBackdrop
              variant="ink"
              className="rounded-3xl"
              contentClassName="flex items-center justify-center px-6 py-14"
            >
              <SampleCard
                tone="dark"
                eyebrow="Ink"
                title="That page has moved."
                body="Neutral and quiet. Error and maintenance pages, where warmth would read as decoration on bad news."
              />
            </CourtBackdrop>
          </div>
        </Section>

        {/* ── Listbox ────────────────────────────────────────────────────── */}
        <Section
          title="Listbox"
          note="Replaces the native select"
          why="Same contract as a select, string in and string out, so swapping one is a one-line change. Arrows, Home and End, type the first letters of a label to jump, Escape to back out. Long lists flip upward when there is no room below."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Shirt size" htmlFor="ck-size">
              <BrandListbox
                id="ck-size"
                value={size}
                onChange={setSize}
                options={SHIRT_SIZES}
                ariaLabel="Shirt size"
              />
            </Field>
            <Field label="Home venue" htmlFor="ck-venue">
              <BrandListbox
                id="ck-venue"
                value={venue}
                onChange={setVenue}
                options={VENUES}
                placeholder="Choose a venue"
                ariaLabel="Home venue"
              />
              <p className="text-ink-500 mt-1.5 text-[12.5px]">
                Twenty options. Type <span className="font-semibold">iron</span> with the list open.
              </p>
            </Field>
            <Field label="With an error" htmlFor="ck-error">
              <BrandListbox
                id="ck-error"
                value=""
                onChange={() => undefined}
                options={SHIRT_SIZES}
                placeholder="Pick a size"
                ariaLabel="Shirt size with an error"
                error
              />
              <p className="text-hoop-700 mt-1.5 text-[12.5px] font-semibold">
                Pick a size before you continue.
              </p>
            </Field>
            <Field label="Disabled" htmlFor="ck-disabled">
              <BrandListbox
                id="ck-disabled"
                value="ym"
                onChange={() => undefined}
                options={SHIRT_SIZES}
                ariaLabel="Disabled example"
                disabled
              />
            </Field>
          </div>
        </Section>

        {/* ── Chips ──────────────────────────────────────────────────────── */}
        <Section
          title="Chips"
          note="Three to six known answers"
          why="One tab stop for the whole set, arrows move the choice. Faster to read than a dropdown and it saves the native picker sheet on a phone."
        >
          <div className="space-y-6">
            <Field label="Division">
              <ChipGroup value={gender} onChange={setGender} options={GENDERS} ariaLabel="Division" />
            </Field>
            <Field label="Position">
              <ChipGroup
                value={position}
                onChange={setPosition}
                options={POSITIONS}
                ariaLabel="Position"
              />
            </Field>
            <Field label="Coaching certification">
              <ChipGroup
                value={cert}
                onChange={setCert}
                options={CERT_LEVELS}
                ariaLabel="Coaching certification"
                allowClear
              />
              <p className="text-ink-500 mt-2 text-[12.5px]">
                Optional field, so clicking the chosen chip again clears it. Currently{" "}
                <span className="font-semibold">{cert || "not set"}</span>.
              </p>
            </Field>
          </div>
        </Section>

        {/* ── Choice cards ───────────────────────────────────────────────── */}
        <Section
          title="Choice cards"
          note="When every option needs a sentence"
          why="The onboarding role picker, lifted out. Payment plans, merge targets, package pickers: same radio group, room for the explanation."
        >
          <ChoiceCardGroup
            value={plan}
            onChange={setPlan}
            options={PAYMENT_PLANS}
            ariaLabel="Payment plan"
          />
        </Section>

        {/* ── Checkbox ───────────────────────────────────────────────────── */}
        <Section
          title="Checkbox"
          note="A real input, brand paint"
          why="The commitment on line one, the reason it is being asked on line two. Still a native checkbox underneath, so form libraries and screen readers see nothing unusual."
        >
          <div className="space-y-3">
            <BrandCheckbox
              checked={waiver}
              onChange={setWaiver}
              label="I have read and accept the waiver"
              subLabel="A copy goes to your email as soon as you sign."
            />
            <BrandCheckbox
              checked={adult}
              onChange={setAdult}
              label="I confirm I am 18 years of age or older"
              subLabel="Running clubs, leagues or officiating is for adults."
            />
            <BrandCheckbox
              checked={false}
              onChange={() => undefined}
              disabled
              label="Send me weekly game recaps"
              subLabel="Available once your child is on a roster."
            />
          </div>
        </Section>

        {/* ── Calendar ───────────────────────────────────────────────────── */}
        <Section
          title="Calendar"
          note="Same picker, brand treatment"
          why="Court navy on the month band, amber on the chosen day, an amber outline on today. Behaviour and value contract are untouched: it still hands back the exact string a native date input would."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Field label="Date of birth" htmlFor="ck-dob">
                <DateTimePicker
                  id="ck-dob"
                  mode="date"
                  value={dob}
                  onChange={setDob}
                  yearRange={[2005, 2020]}
                />
              </Field>
              <p className="text-ink-500 mt-3 text-[12.5px]">
                Value: <span className="text-ink-800 font-semibold">{dob || "empty"}</span>
              </p>
            </div>
            <div>
              <Field label="Tip off" htmlFor="ck-tipoff">
                <DateTimePicker id="ck-tipoff" mode="datetime" value={tipOff} onChange={setTipOff} />
              </Field>
              <p className="text-ink-500 mt-3 text-[12.5px]">
                Date and time in one panel. Value:{" "}
                <span className="text-ink-800 font-semibold">{tipOff || "empty"}</span>
              </p>
            </div>
          </div>
        </Section>
      </div>
    </main>
  )
}

function Section({
  title,
  note,
  why,
  children,
}: {
  title: string
  note: string
  why: string
  children: React.ReactNode
}) {
  return (
    <section className="border-ink-100 rounded-3xl border bg-white p-6 shadow-sm sm:p-7">
      <div className="mb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-ink-950 text-[19px] font-black">{title}</h2>
          <span className="bg-play-50 text-play-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
            {note}
          </span>
        </div>
        <p className="text-ink-500 mt-1.5 text-[13px] leading-5">{why}</p>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  // Groups (chips, cards) carry their own aria-label, so a dangling <label>
  // with nothing to point at would be a lie to a screen reader.
  const labelClass = "text-ink-800 mb-1.5 block text-[13px] font-bold uppercase tracking-wide"
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <p className={labelClass}>{label}</p>
      )}
      {children}
    </div>
  )
}

function SampleCard({
  tone,
  eyebrow,
  title,
  body,
}: {
  tone: "dark" | "light"
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div
      className={`w-full max-w-sm rounded-2xl p-6 shadow-xl ${
        tone === "dark" ? "bg-white/95" : "border-ink-100 border bg-white"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b45309]">{eyebrow}</p>
      <h3 className="text-ink-950 mt-2 text-2xl font-black leading-tight">{title}</h3>
      <p className="text-ink-600 mt-2 text-[13.5px] leading-5">{body}</p>
      <button
        type="button"
        className="mt-4 min-h-[44px] w-full cursor-pointer rounded-xl bg-[#f59e0b] px-5 py-3 text-[15px] font-bold text-[#451a03] shadow-md transition-colors duration-200 hover:bg-[#fbbf24] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b] focus-visible:ring-offset-2"
      >
        Sample action
      </button>
    </div>
  )
}
