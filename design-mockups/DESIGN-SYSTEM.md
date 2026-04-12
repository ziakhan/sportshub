# Youth Basketball Hub - Design System Recommendations

## Overview

Two complementary design directions that share a unified brand identity (navy + orange) while being optimized for their distinct purposes.

---

## Shared Brand Identity

| Token | Value | Usage |
|-------|-------|-------|
| **Navy 950** | `#0b1628` | Primary dark background |
| **Orange 500** | `#f97316` | Primary brand accent, CTAs |
| **Green 500** | `#22c55e` | Success, teams, positive indicators |
| **Purple 600** | `#8b5cf6` | Offers, leagues |
| **Blue 600** | `#3b82f6` | Staff, info, pending states |

---

## 1. Public-Facing UI

### Style: Vibrant Athletic

Bold, energetic, community-focused. The public site should feel like stepping into a gym — high energy, clear direction, confidence.

### Typography

| Role | Font | Weight | Why |
|------|------|--------|-----|
| **Headings** | Barlow Condensed | 700-800 | Athletic, condensed, impactful — perfect for sports |
| **Body** | Barlow | 400-500 | Same family, great readability, keeps the athletic feel |

```
Google Fonts: Barlow Condensed:wght@400;500;600;700;800 | Barlow:wght@300;400;500;600;700
```

### Key Design Elements

- **Hero:** Dark navy gradient with subtle orange radial glow, animated basketball court lines
- **Stats Bar:** Live platform numbers (188+ clubs, 2400+ players) — social proof
- **Cards:** White with colored top border (type-coded: orange=tryout, green=house league, purple=camp)
- **CTAs:** Rounded-lg (not pill), orange with shadow, hover arrow animation
- **Section Labels:** Uppercase tracking-wide with orange underline accent
- **Club Cards:** Banner gradient (club color) + floating logo badge
- **Footer:** 4-column navy with organized links

### Color Palette (Public)

| Element | Color | Hex |
|---------|-------|-----|
| Hero bg | Navy gradient | `#0b1628` → `#1e2d4d` |
| Headings | Navy 950 | `#0b1628` |
| Body text | Gray 600 | `#4b5563` |
| CTA primary | Orange 500 | `#f97316` |
| CTA secondary | Navy 950 | `#0b1628` |
| Card bg | White | `#ffffff` |
| Section bg alt | Gray 50 | `#f9fafb` |
| Tryout badge | Orange | `#f97316` |
| House League badge | Green | `#22c55e` |
| Camp badge | Purple | `#8b5cf6` |
| Tournament badge | Blue | `#3b82f6` |

### Landing Page Structure

1. **Sticky Nav** — Glass effect (bg-navy-950/95 backdrop-blur), logo + links + CTA
2. **Hero** — Split layout: headline + stats (left) + search card (right)
3. **Social Proof Bar** — Trust badges (188+ clubs, free to start, Stripe payments)
4. **Featured Programs** — Filterable cards grid with type pills
5. **Value Props** — 4-column audience cards (Parents, Clubs, Referees, Leagues)
6. **Featured Clubs** — Banner-style club cards with team/tryout counts
7. **Final CTA** — Dark gradient with orange headline accent
8. **Footer** — 4-column organized links

---

## 2. Dashboard UI

### Style: Clean Professional SaaS

Data-dense but breathable. The dashboard should feel efficient and trustworthy — club owners spend hours here managing teams, tryouts, and offers.

### Typography

| Role | Font | Weight | Why |
|------|------|--------|-----|
| **Headings** | Barlow Condensed | 600-700 | Keeps brand continuity from public site |
| **Body/Data** | Inter | 400-500 | Industry-standard for dashboards, excellent readability at small sizes |

### Key Design Elements

- **Sidebar:** Navy 950, 260px wide, icon+text nav links, badge counts, section headers
- **Active state:** Orange left border + orange tint background (not full bg change)
- **Top Bar:** White, clean — breadcrumb + search + notifications + user avatar
- **Stat Cards:** White with colored top border (3px), icon in colored bg circle, trend indicator
- **Needs Attention:** Animated orange dot, actionable list items with severity icons
- **Offer Pipeline:** 4-stage horizontal pipeline (Pending/Accepted/Declined/Expired)
- **Team Cards:** Compact cards with player avatar stack, coach info, status badges
- **Activity Feed:** Timeline-style with colored action icons

### Color Palette (Dashboard)

| Element | Color | Hex |
|---------|-------|-----|
| Sidebar bg | Navy 950 | `#0b1628` |
| Top bar bg | White | `#ffffff` |
| Content bg | Slate 50 | `#f8fafc` |
| Card bg | White | `#ffffff` |
| Card border | Gray 100 | `#f3f4f6` |
| Teams accent | Green | `#22c55e` / `#f0fdf4` bg |
| Tryouts accent | Orange | `#f97316` / `#fff7ed` bg |
| Offers accent | Purple | `#8b5cf6` / `#faf5ff` bg |
| Staff accent | Blue | `#3b82f6` / `#eff6ff` bg |
| Danger | Red | `#ef4444` |
| Warning | Yellow | `#eab308` |

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│ [Sidebar 260px] │ [Top Bar - white]             │
│                 │ breadcrumb / search / avatar   │
│ Logo            ├───────────────────────────────│
│ ─── My Club     │                               │
│   Overview      │  Page Header + Quick Actions  │
│   Teams (8)     │                               │
│   Tryouts (3)   │  [Stat Cards - 4 cols]        │
│   Offers (5)    │                               │
│   House Leagues │  [Needs Attention] [Pipeline] │
│   Camps         │                               │
│   Tournaments   │  [Teams Grid - 4 cols]        │
│   Staff         │                               │
│ ─── Browse      │  [Recent Activity Feed]       │
│   Leagues       │                               │
│   Tournaments   │                               │
│ ─── Settings    │                               │
└─────────────────────────────────────────────────┘
```

---

## What Changed vs Current Design

| Element | Current | Recommended |
|---------|---------|-------------|
| **Headings font** | Inter everywhere | Barlow Condensed for headings (athletic feel) |
| **Public body font** | Inter | Barlow (athletic family consistency) |
| **Dashboard body** | Inter | Keep Inter (excellent for data) |
| **Hero search** | Inline search bar | Glass card with live results preview |
| **Social proof** | None | Trust bar below hero |
| **Program cards** | Colored top bar | Colored top bar + type badges + price prominent |
| **Club cards** | Flat with color dot | Banner gradient + floating logo badge |
| **Sidebar active** | bg-navy-800 | Orange left border + orange tint |
| **Sidebar badges** | None | Color-coded count badges |
| **Stat cards** | Emoji prefixes | Icon in colored circle + trend indicator |
| **Needs attention** | Orange alert box | Dedicated card with animated dot + actionable list |
| **Offer pipeline** | 4-column numbers | Colored stage cards + recent offers table |
| **Team cards** | Simple text | Avatar stack + coach info + status border |
| **Activity feed** | None | Timeline with colored action icons |
| **Nav breadcrumb** | None | Breadcrumb trail in top bar |
| **Section headers** | Emoji + text | Uppercase label with orange line accent |

---

## Implementation Notes

- **No existing code was changed** — these are standalone mockup files
- Both mockups use Tailwind CDN for quick prototyping
- Fonts load from Google Fonts CDN
- To implement: update `tailwind.config.ts` font families, add Barlow/Barlow Condensed to root layout
- The nav/sidebar active state pattern can be applied incrementally
- Color-coded entity types (green=teams, orange=tryouts, purple=offers, blue=staff) are already partially in use — this formalizes and extends the pattern

---

## Files

- `design-mockups/public-facing.html` — Full landing page mockup
- `design-mockups/dashboard.html` — Club dashboard mockup
- `design-mockups/DESIGN-SYSTEM.md` — This file
