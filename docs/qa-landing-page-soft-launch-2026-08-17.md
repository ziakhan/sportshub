# Landing Page Soft-Launch Review — 2026-08-17

Kai's mobile-view testing and feedback on the landing page before soft launch.
Collected as actionable items for dev implementation.

**Page under review:** currently served at `/dev/home-preview`
(`apps/web/src/app/dev/home-preview/`). This is the page intended to become the
public home page at soft launch — the route swap itself is still an open task
and is NOT covered by this document.

---

## ⛔ SCOPE — MOBILE ONLY (owner, 2026-08-17)

**Every item in this document applies to the mobile viewport ONLY. Desktop,
laptop and all intermediate breakpoints must render EXACTLY as they do today —
pixel for pixel. No exceptions.**

This is stricter than it sounds in a mobile-first Tailwind codebase, and it is
the easiest constraint to break by accident. Changing a base utility class
(e.g. `text-base` → `text-sm`) changes it at *every* width, not just phone.

Two safe ways to implement, both acceptable:

1. **`max-*` variants** — scope the change so it cannot leak upward:
   `max-sm:text-sm`, `max-sm:px-3`. Desktop classes are never touched.
2. **Change the base, then restore desktop explicitly** — if you change a base
   class, you MUST add the matching `sm:`/`md:`/`lg:` override that pins the
   current desktop value back.

Option 1 is preferred; it makes the diff self-documenting and impossible to
misread later.

**Verification required before this ships:** screenshot the desktop layout
before and after the change and confirm they are identical. A desktop
regression is a failed implementation of these items, regardless of how good
the mobile result looks.

## Visual & Layout Issues

### 1. Header auth buttons ("Watch the demos" + "Sign in") — distorted and overlapping the logo
**Severity:** Blocker for launch — this is the first thing a phone visitor sees.
**Status: ✅ IMPLEMENTED** in `apps/web/src/app/dev/home-preview/preview.tsx`
(the `Hero()` header). Details of what was actually done are at the end of this
item — the diagnosis and requirements below are kept for review context.

**Issue (mobile only):** The two buttons in the top-right are distorted and
mis-sized, and "Watch the demos" overlaps the SportsHub ONE logo. They also
render in two different colours, so they don't read as a pair. On desktop the
same header is fine — this is purely a phone-width failure.

**Decision (owner):** Responsive shrinking. Keep both buttons visible in the
header; do not move them to a menu, do not hide either one, do not stack them.

**Implementation — mobile only:**
- Shrink type and padding at phone width using `max-sm:` variants so desktop is
  untouched. Do NOT edit the existing desktop classes.
- Guarantee clearance from the logo. A shared header row using `flex` with a
  real `gap` and `min-w-0` on the logo side is more robust than nudging padding
  until it happens to fit — overlap means the two are currently allowed to
  occupy the same space, so constrain the layout, don't just shrink the text.
- **Both buttons must use the same colour treatment.** Pick one pairing and pull
  both from the same tokens — the current mismatch reads as a bug, not a
  hierarchy. Note the brand palette rule: navy stage + play blue + hoop-500
  orange. **Amber is demo chrome only and must not be used here.**
- Buttons must still *look like buttons* at phone width — visible background or
  border, not bare text. Shrinking must not flatten them into links.
- **Minimum 44×44px touch target** (Apple HIG) even after shrinking, with at
  least 8px between the two. This is a hard floor; if the text must get small
  enough to violate it, the layout approach is wrong, not the font size.

**Verify at:** 320px (small phone), 390px (iPhone standard), 430px (Pro Max),
and confirm desktop is unchanged.

#### What was implemented

Root cause found on inspection: the two items were never buttons. They were
bare `<Link>` text at **two different opacities** — `text-white/80` and
`text-white/60` — which is exactly the "two different colours / just words
there" observation. The overlap was a space problem: the `xl` wordmark is
~205px, and two full-length labels could not share a 390px row with it.

Changes, all fenced to `< 640px`:

| Concern | Fix |
|---|---|
| Logo overlap | Wordmark renders `xl` at `sm+` (unchanged) and `md` on phone, via a `sm:hidden` / `max-sm:hidden` pair. `size` is a prop, not a class, so it can't be made responsive in place. |
| Not button-like | Both links get `max-sm:` pill chrome — `bg-white/10`, `ring-1 ring-white/25`, `rounded-full`, `font-bold`. |
| Colour mismatch | Both use the **same** treatment on phone. The two desktop opacities are untouched. |
| Touch target | `max-sm:min-h-[44px]` (Apple HIG floor) + `max-sm:gap-2` for the 8px separation. |
| Fit | Label shortens to "Demos" on phone only. `aria-label="Watch the demos"` on the link preserves the full accessible name. |

**Palette note:** deliberately neutral white-on-navy — no amber, per the rule
that amber is demo chrome only.

**⚠️ Two things a reviewer should confirm with their own eyes:**
1. **Desktop pixel-identity.** The wordmark is now wrapped in a `<span>` that
   is the flex child instead of being the flex child itself. This *should*
   render identically (the inner element is `inline-flex`), but it is markup
   change on the desktop path and deserves the before/after screenshot check.
2. **The shortened "Demos" label is a judgement call, not an owner decision.**
   The full label genuinely does not fit at 390px once the 44px tap target is
   honoured. If the full wording is required on phone, the alternatives are a
   smaller logo again or moving the nav to its own row — flag it and it can be
   revisited.

---

### 2. Court-line backdrop — too cluttered once everything collapses to one column
**Issue (mobile only):** On phone, with the layout collapsed into a single
column, the basketball-court line backdrop competes with the content. Combined
with the number of accent colours already in play, the page reads as busy
rather than sleek. Desktop has room to carry the court treatment and looks
good — this is specific to the collapsed mobile layout.

**Decision (owner): remove the court-line backdrop on mobile.** Desktop keeps
it exactly as-is.

**Explicitly KEEP (owner, unambiguous):** every one of the rotating hero
key-points / persona cards. All of them stay, and they keep rotating. They are
the proof that the platform is inclusive and complete — "we want them to think,
*wow, this is a really inclusive one app*." Nothing about the carousel content
is being reduced. The removal above concerns **background decoration only.**

**Recommendation for what replaces it (not yet owner-approved — needs a look
once built):** rather than leaving the mobile background flat, keep one or two
soft, low-opacity blur glows in brand colours as ambient texture. This is the
same technique already used on the auth panel, where the finding was that soft
light reads as intentional while hard-edged geometric motifs read as debris.
Reducing the *number* of competing accent colours in the background is the goal
— the content keeps its full colour.

**QA note:** run a UI/UX review pass on the built result to confirm the mobile
page still feels branded and deliberate rather than empty. "Simplified" must not
become "bare."

## Interaction & UX

_TBD_

## Content & Copy

_TBD_

## Design Fidelity

_TBD_

## Performance & Loading

_TBD_

## Suggestions for Future Polish

_TBD_

---

**Testing Environment:** Phone view (390px+), localhost  
**Tester:** Kai (owner, design/UX eye)  
**Status:** Work in progress
