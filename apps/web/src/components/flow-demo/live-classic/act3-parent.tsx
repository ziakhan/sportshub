"use client"

/**
 * Act 3 — Maria finds the tryout and signs Jayden up: browses the programs
 * marketplace, searches, opens the listing, registers, and pays the fee.
 * Mirrors /events, /tryout/[id], /tryouts/[id] and /payments.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { StarRating } from "@/components/ui/star-rating"
import { CLUB, KID, TRYOUT, fmt } from "../data"
import { Field, PhonePage } from "../scenes/shared"
import { LiveCheck, LiveInput, LiveSelect } from "./anim"
import type { LiveScene } from "./engine"
import { pick, tick, typeIn } from "./helpers"

const MARIA = "Maria (parent)"

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

/* One program card, mirrored from the real /events browse (events-browser.tsx). */
function ProgramCard({
  color,
  type,
  spots,
  name,
  club,
  rating,
  reviews,
  lines,
  fee,
  holdId,
  rowIn,
}: {
  color: string
  type: "Tryout" | "Camp" | "House League"
  spots: string
  name: string
  club: string
  rating?: number
  reviews?: number
  lines: string[]
  fee: string
  holdId?: string
  rowIn?: boolean
}) {
  const badge =
    type === "Tryout"
      ? "bg-hoop-50 text-hoop-600"
      : type === "Camp"
        ? "bg-violet-100 text-violet-700"
        : "bg-court-50 text-court-700"
  const card = (
    <div className={cn("card-lift border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white", rowIn && "live-row-in")}>
      <div className="h-2" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge)}>{type}</span>
          <span className="text-ink-400 text-xs">{spots}</span>
        </div>
        <h3 className="text-ink-950 mb-1 font-semibold">{name}</h3>
        <p className="text-ink-500 text-sm">{club}</p>
        {rating != null && (
          <div className="mb-2 mt-0.5">
            <StarRating rating={rating} count={reviews} />
          </div>
        )}
        <div className="text-ink-500 space-y-1 text-xs">
          {lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        <div className="border-ink-100 mt-3 flex items-center justify-between border-t pt-3">
          <span className={cn("text-lg font-bold", fee === "FREE" ? "text-court-600" : "text-hoop-600")}>{fee}</span>
        </div>
      </div>
    </div>
  )
  return holdId ? (
    <Hold id={holdId} block>
      {card}
    </Hold>
  ) : (
    card
  )
}

/* 11 — Browse the marketplace: tryouts near her, clubs rated by other parents */
const browse: LiveScene = {
  id: "l-browse",
  act: "parent",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption:
    "Maria taps Tryouts: every tryout near her, with each club's parent rating, date, gym and fee. The Force is the one.",
  script: [
    { wait: 900 },
    { press: "pillTryouts" },
    { set: { pill: true } },
    { wait: 2600 },
    { hold: "tryoutCard" },
  ],
  render: (g) => (
    <PhonePage>
      <h1 className="text-ink-950 text-3xl font-bold">Find Programs &amp; Tryouts</h1>
      <p className="text-ink-600 mt-2">
        Browse tryouts, house leagues, camps, and tournaments to find the right fit for your
        player.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["All", "Tryouts", "House Leagues", "Camps", "Tournaments"].map((p, i) => (
          <span
            key={p}
            data-live-id={i === 1 ? "pillTryouts" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              (g("pill") ? i === 1 : i === 0) ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700"
            )}
          >
            {p}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <LiveInput id="search" value={g("q") as string} caret={false} placeholder="Search by name, club, or location..." />
      </div>
      <div className="mt-4 space-y-3">
        <ProgramCard
          color={CLUB.color}
          type="Tryout"
          spots="12/40 signed up"
          name={TRYOUT.title}
          club={CLUB.name}
          rating={4.8}
          reviews={26}
          lines={[TRYOUT.dateShort, "Haber Recreation Centre, Burlington", "U16 • Boys"]}
          fee={fmt(TRYOUT.fee)}
          holdId="tryoutCard"
          rowIn={!!g("pill")}
        />
        <ProgramCard
          color="#9333ea"
          type="Tryout"
          spots="18/40 signed up"
          name="Grade 9 Boys Spring Tryout"
          club="Royal Crown"
          rating={4.6}
          reviews={19}
          lines={["Apr 11, 2026", "Scarborough", "U16 • Boys"]}
          fee="FREE"
          rowIn={!!g("pill")}
        />
        <ProgramCard
          color="#be123c"
          type="Tryout"
          spots="9/36 signed up"
          name="Grade 10 Boys Summer Tryout"
          club="Oakville Panthers"
          rating={4.2}
          reviews={11}
          lines={["Apr 14, 2026", "Oakville Sixteen Mile Complex", "U16 • Boys"]}
          fee="$20.00"
          rowIn={!!g("pill")}
        />
        {!g("pill") && (
          <ProgramCard
            color="#0f766e"
            type="Camp"
            spots="31 registered"
            name="Summer Skills Camp"
            club="City Above Elite"
            rating={4.5}
            reviews={14}
            lines={["Jul 6, 2026", "Summer • 6 weeks"]}
            fee="$180.00"
          />
        )}
      </div>
    </PhonePage>
  ),
}

/* 12 — The listing */
const details: LiveScene = {
  id: "l-details",
  act: "parent",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption: "Everything a parent needs before committing: date, gym, age group, spots left and the fee.",
  script: [{ wait: 900 }, { hold: "signupBtn" }],
  render: () => (
    <PhonePage noHeader className="p-0 px-0 pt-0">
      <div className="px-4 py-3 text-white" style={{ backgroundColor: CLUB.color }}>
        <p className="text-xs opacity-90">&larr; Back to Marketplace</p>
        <p className="mt-1 text-sm font-bold">{CLUB.name}</p>
      </div>
      <div className="space-y-3 px-4 py-4">
        <Card size="sm">
          <Badge tone="court" dot>
            Open
          </Badge>
          <h1 className="text-ink-950 mt-2 text-lg font-bold">{TRYOUT.title}</h1>
          <p className="text-ink-600 mt-1 text-sm">
            Full-court scrimmages and skills stations. Bring indoor shoes, a water bottle, and a
            reversible if you have one.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Date & Time", `${TRYOUT.dateLong}\n6:30 PM (90 min)`],
              ["Location", "Haber Recreation Centre, Burlington"],
              ["Age Group & Gender", "U16 • Boys"],
              ["Spots", "12 signed up (28 spots left)"],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-50 rounded-xl p-3">
                <p className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.12em]">{k}</p>
                <p className="text-ink-900 mt-1 whitespace-pre-line text-xs font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card size="sm" className="text-center">
          <p className="text-ink-950 text-2xl font-bold">{fmt(TRYOUT.fee)}</p>
          <p className="text-ink-400 text-xs">per player</p>
          <div className="mt-3">
            <Hold id="signupBtn" block>
              <Button block>Sign Up Now</Button>
            </Hold>
          </div>
        </Card>
      </div>
    </PhonePage>
  ),
}

/* 13 — Register: pick the kid, consent, sign up */
const signup: LiveScene = {
  id: "l-signup",
  act: "parent",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption: "She picks which of her kids is trying out. The fee is created as an open item to pay.",
  script: [
    { wait: 400 },
    ...pick("playerSel", "player", 0, KID.name),
    ...tick("consent", "consent"),
    { hold: "payBtn" },
    { confirm: "Signup registered!" },
  ],
  render: (g) => (
    <PhonePage noHeader className="p-0 px-0 pt-0">
      <div className="px-4 py-3 text-white" style={{ backgroundColor: CLUB.color }}>
        <p className="text-xs opacity-90">&larr; {CLUB.name}</p>
        <p className="mt-1 text-sm font-bold">{TRYOUT.title}</p>
      </div>
      <div className="space-y-3 px-4 py-4">
        <Card size="sm">
          <p className="text-ink-950 mb-3 text-base font-bold">Sign up</p>
          <div className="space-y-3.5">
            <Field label="Select Player" required>
              <LiveSelect
                id="playerSel"
                value={g("player") as string}
                placeholder="Choose a player..."
                open={!!g("player:open")}
                options={[KID.name, "Emma Thompson"]}
                highlight={g("player:hi") as number}
              />
            </Field>
            <div className="bg-amber-50 text-amber-800 rounded-xl p-3 text-xs">
              This tryout requires a {fmt(TRYOUT.fee)} fee. Payment processing will be available
              soon. Your signup will be marked as pending until payment is completed.
            </div>
            <LiveCheck id="consent" on={!!g("consent")} label="Email me about future programs from this club" />
            <Hold id="payBtn" block>
              <Button block>Sign Up ({fmt(TRYOUT.fee)})</Button>
            </Hold>
          </div>
        </Card>
      </div>
    </PhonePage>
  ),
}

/* 14 — Pay the fee from My Payments */
const payFee: LiveScene = {
  id: "l-pay-fee",
  act: "parent",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption: "The tryout fee sits as an open item with the club named on it. She pays it right there.",
  script: [
    { wait: 500 },
    { press: "payOnline" },
    { set: { modal: true } },
    { wait: 600 },
    ...typeIn("card", "card", "4242 4242 4242 4242", 32),
    ...typeIn("exp", "exp", "04 / 28", 16),
    ...typeIn("cvc", "cvc", "•••", 10),
    { hold: "payNow" },
    { set: { modal: false, paid: true } },
    { confirm: "✓ Payment received" },
    { wait: 700 },
  ],
  render: (g) => (
    <PhonePage className={cn(!!g("modal") && "bg-ink-900/40")}>
      {!g("modal") ? (
        <>
          <Badge tone="play">Payments</Badge>
          <h1 className="text-ink-950 mt-2 text-xl font-bold">My Payments</h1>
          <p className="text-ink-500 mt-1 text-sm">
            {g("paid") ? "You're all settled up." : `1 open item, ${fmt(TRYOUT.fee)} outstanding.`}
          </p>
          <Card size="sm" className="mt-4">
            <div className="border-ink-100 rounded-xl border p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-ink-900 text-sm font-bold">
                    {TRYOUT.title} · {KID.name}
                  </p>
                  <p className="text-ink-500 mt-0.5 text-xs">
                    To <span className="text-play-700 font-semibold">{CLUB.name}</span>
                  </p>
                </div>
                {g("paid") ? (
                  <span className="live-pop inline-block">
                    <Badge tone="success">Paid</Badge>
                  </span>
                ) : (
                  <Badge tone="gold">Owed</Badge>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-ink-50 text-ink-500 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Tryout fee
                  </span>
                  <span className="text-ink-900 text-sm font-bold">{fmt(TRYOUT.fee)}</span>
                </div>
                {!g("paid") && (
                  <span data-live-id="payOnline" className="inline-block rounded-xl">
                    <Button size="sm">Pay online</Button>
                  </span>
                )}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <div className="mt-14">
          <Card className="live-pop">
            <p className="text-ink-950 text-lg font-bold">Pay {fmt(TRYOUT.fee)}</p>
            <div className="mt-4 space-y-3">
              <Field label="Card number">
                <LiveInput id="card" value={g("card") as string} caret={!!g("card:caret")} placeholder="1234 1234 1234 1234" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Expiry">
                  <LiveInput id="exp" value={g("exp") as string} caret={!!g("exp:caret")} placeholder="MM / YY" />
                </Field>
                <Field label="CVC">
                  <LiveInput id="cvc" value={g("cvc") as string} caret={!!g("cvc:caret")} placeholder="CVC" />
                </Field>
              </div>
              <p className="text-ink-400 text-xs">Payments are processed securely by Stripe.</p>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="subtle">Cancel</Button>
              <Hold id="payNow" block>
                <Button block>Pay {fmt(TRYOUT.fee)}</Button>
              </Hold>
            </div>
          </Card>
        </div>
      )}
    </PhonePage>
  ),
}

export const ACT3: LiveScene[] = [browse, details, signup, payFee]
