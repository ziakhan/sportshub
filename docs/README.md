# SportsHub Docs — an Obsidian vault

This folder is a linked knowledge base of product plans, designs, research, and
operational ledgers. It is set up to be browsed as an **[Obsidian](https://obsidian.md)
vault** — notes are connected with `[[wikilinks]]`, grouped by *Maps of Content*
(hub notes), and tagged with frontmatter so the graph and search do the
navigating for you.

> **Reading on GitHub?** Wikilinks (`[[note]]`) show as plain text here — that's
> expected. This README uses normal links so it stays readable. Open the folder
> in Obsidian for the full experience.

## Open it

1. Install [Obsidian](https://obsidian.md) (free).
2. **Open folder as vault** → choose this `docs/` folder.
3. Start at **[Home](Home.md)** — the dashboard that links every hub.
4. Open the **Graph view** (left ribbon) to see how everything connects.

## How it's organized

Files stay where they are (they're referenced by path elsewhere in the repo);
organization is layered on top with **hub notes** ("Maps of Content"):

| Hub | Covers |
|---|---|
| [**✅ What's Built**](_moc-shipped.md) | **feature-by-feature list of everything shipped — start here** |
| [Payments](_moc-payments.md) | Stripe architecture, plan v2, open items |
| [Leagues & Scheduling](_moc-leagues.md) | League v2 plan + design Q&A |
| [Live Scoring](_moc-scoring.md) | Scoring plan + design |
| [Onboarding & Tutorials](_moc-onboarding.md) | Onboarding flow, tutorial scripts |
| [Public Site · Content · UX](_moc-content-ux.md) | Site IA, content plan, home redesign, UX audit, design strategy |
| [Offers & Engagement](_moc-offers-engagement.md) | Offer packages, engagement features |
| [Architecture & Testing](_moc-architecture.md) | Architecture review, club/venue model, test architecture, e2e, perf |
| [GTM & Outreach](_moc-gtm.md) | Value prop, emails, demo/social plans |
| [Market Research](_moc-research.md) | Census + landscape + competitor data |
| [Demos](_moc-demos.md) | Demo world seed, demo scripts |
| [Status & Ledgers](_moc-ledgers.md) | Outstanding items, launch blockers, backlog, deploy actions |
| [Product Spec & System](_moc-spec.md) | Platform spec, sprint history, system prompts |

## Conventions

Each note carries lean **frontmatter** — an `updated` date plus `tags` that
drive graph coloring and Dataview queries:

```yaml
---
updated: 2026-07-04
tags: [theme/payments, type/design, status/shipped]
---
```

The tags encode three axes (that's why they're tags, not separate properties —
one source of truth, and Obsidian's graph colors by tag):

- **`theme/…`** — `payments · leagues · scoring · onboarding · content-ux · offers · engagement · architecture · testing · gtm · research · demos · ledgers · spec · system` (one or two)
- **`type/…`** — `plan · design · spec · research · ledger · outreach · tutorial · reference`
- **`status/…`** — `shipped · in-progress · planned · draft · living · reference · superseded · archived`

> **Note on `status`:** it describes the *document*, not the feature. A `plan`
> stays `plan`-typed after its feature ships, and completed work often lives
> inside `living` ledgers — so the graph *undersells* progress by design. For an
> honest "what's done," use [**What's Built**](_moc-shipped.md).

**Adding a doc?** Give it that frontmatter and add a `[[wikilink]]` to it from
the relevant hub note. That's all — the graph picks it up automatically.

## Recommended plugins

- **Dataview** — turn tags into live tables, e.g. ` ```dataview TABLE updated FROM #status/in-progress SORT updated DESC``` `. The hubs are hand-maintained today; Dataview can make parts of them self-updating later.
- **Graph view** (core) — the color **Groups** live in the graph view's *own* control panel (the sliders icon at the graph's top-left), **not** app Settings. Add a group per status, e.g. `tag:#status/shipped` (green) … `tag:#status/planned` (amber), plus `tag:#moc` for the hubs.
