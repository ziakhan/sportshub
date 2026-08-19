---
updated: 2026-08-19
tags: [theme/research, theme/competitor, type/analysis, status/first-pass]
---

# Communiti — the payments rail, priced so the club never sees a bill

**Source of the sighting: the owner's daughter's volleyball team pays camp and team fees through it.** That is a live, in-market Ontario customer, not a directory listing. It was absent from every one of our research docs, including [[competitor-tracker]] and [[tool-feature-matrix-2026-07]], which is the gap worth fixing.

`communiti.app`

---

## 1. What it is

Registration, payments and the admin around them. Nothing else.

| Has | Does not have |
|---|---|
| Online registration and booking pages | Game scheduling |
| Payments at the point of registration | Scores, standings, statistics |
| Digital waivers, medical and custom forms | Live scoring |
| Private lesson and open court booking | Player profiles or records |
| Attendance for practices, clinics, lessons | Team chat (parent-to-admin email only) |
| Waitlists that auto-fill by invite | Anything after a game is played |
| Coupon codes, automated reviews | A mobile app (none advertised) |

**15+ sports, and basketball is on the list**: baseball, basketball, cheer, golf, flag football, hockey, climbing, lacrosse, martial arts, softball, skating, surfing, swimming, tennis, volleyball.

Claimed scale is soft: "100s of sports organizers", "hundreds of clubs, camps and coaches". No athlete or volume figures.

**Named customers skew Ontario and volleyball**, which is exactly where the sighting came from: Ontario Volleyball / ABBV (the provincial body's beach programs), DoSomethingVolleyball, RiseUp Beach Volleyball Club, Kinetika, Lakefield Skating Club, Trenton Figure Skating Club.

## 2. The pricing, which is the actual story

- **$0 per month. No annual fee. No contract.**
- **2% platform fee, minimum $2, per booking** — and it is **added on top, paid by the parent**. Their own worked example: program $500, platform fee $10, *total user pays $510*.
- **Stripe 2.9% + 30¢ passed through with no markup**, stated in public on the pricing page: *"We do not add any markup to these fees."*
- One tier. Full feature access.

**The club never receives an invoice.** That is the whole design, and it is smarter than a low price.

### Modelled against us — a 12-team club, 144 players, $600 a season ($86,400)

| | Communiti | Us, Club Pro $590 |
|---|---|---|
| Parent pays extra | **$1,728** ($12 each, on top) | $0 |
| Club pays Stripe | $2,599 | $2,549 |
| Club gets an invoice | **No** | **Yes, $590** |
| Club out of pocket | **$2,599** | $3,139 passthrough · $4,176 with our card markup |

The arithmetic gap is real but modest. **The psychological gap is the problem**: a volunteer treasurer comparing the two sees "free" against "$590 a year", and the 2% never lands on their desk because a parent absorbed it at checkout.

## 3. What this changes for us

**a) It is a third independent argument against marking up card fees.** [[business-model-v3]] §13 decision 13 already noted RAMP under 2% all-in and TeamLinkt at 2.7% + 30¢ against our 3.4–4.9%. Communiti goes further and **advertises the absence of a markup as a feature**. Three competitors now make "we do not mark up your card fees" a line we cannot say. Decision 13 should close as passthrough.

**b) It pressures the shape of Club Pro, not just the number.** Their model is not cheaper software, it is *invisible* software. Worth testing a variant where the club's cost rides on transactions rather than an annual invoice, or where Pro is waived above a volume line (which §13 decision 3 already contemplates at $50k).

**c) It is the fifth independent confirmation of the moat.** Exposure Events, ARC, RAMP, CYO Connect and now Communiti all stop at the whistle. Communiti stops earlier than any of them: it never even models a game. Nothing to say to a family once the season starts, no app, no record of the athlete.

**d) It is adjacent, not head-on.** Their traction is volleyball and skating in Ontario. Basketball is a listed sport, not a demonstrated base. We are basketball-native, and they are 15 sports wide and one layer deep.

## 4. Where they are genuinely better today

Honest, because pretending otherwise would cost us in a room:

- **Onboarding.** No contract, no subscription, no sales call. A single coach can be taking payments the same afternoon.
- **Seasonality.** A club that runs one summer camp pays nothing for the other ten months. Our annual fee bills through the off-season.
- **Focus.** Registration and payments only, so nothing to learn that a camp organiser does not need.

## 5. Not verified

- Company ownership, location and funding. Not stated on the site.
- Real customer count behind "hundreds".
- Whether the 2% can be configured to fall on the club instead of the parent.
- Any basketball customer at all. Listed as a supported sport, no named club found.
- App store presence, since no app is advertised.

## 6. Suggested next step

Cheap and high-value: **ask the owner's daughter's club what they used before, what it replaced, and whether anyone there has an opinion on it.** One honest customer conversation beats another afternoon of reading their marketing site, and we have direct access to one.

⬅ [[competitor-tracker]] · [[tool-feature-matrix-2026-07]] · [[business-model-v3]] · [[teamlinkt-deep-dive-2026-08]]
