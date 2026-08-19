# Organic social launch plan — zero to an audience (2026-08-19)

Companion to [club-ad-strategy-2026-07](club-ad-strategy-2026-07.md), which
covers **paid**. This one covers **organic**: what to post, in what order,
from an account with zero followers, to drive traffic to the site before
launch.

---

## 1. The correction that matters most

The working assumption was "we have 1,300 clubs whose social accounts we
already have, so we can target them directly." Half right, and the half that
is wrong changes the mechanism.

**Verified, LOCAL DB `youthbasketballhub`, under the product's own visibility
filters (`publishedAt` set, `mergedIntoId` null, `isDemo` false):**

| What | Count |
|---|---|
| Visible clubs | 1,323 |
| With a website | 1,055 |
| With a contact email | 1,001 |
| With a phone number | 665 |
| **With an Instagram handle** | **0** |
| With any `socials` row at all | 1 |

Instagram handles are not in the database. They were never imported. Sweeping
`docs/research/raw/` for `instagram.com/<handle>` finds **100 unique handles**
across 23 files, not 1,300.

⚠️ The box is production and holds a different snapshot (last recorded around
1,488 in the public directory). Confirm any number against the box before it
goes on a creative, and never print a count without naming the database.

**But the plan still works, through a different door.** Meta's Customer List
Custom Audience matches on **email**, not on Instagram handle. You have 1,001
club emails. Upload them in Ads Manager and Meta finds those people's
Instagram and Facebook accounts for you. You never needed the handles.

So:

- **Paid targeting of clubs: viable today.** Email list → Custom Audience.
  Already the plan in the July doc.
- **Manual IG outreach to clubs: not viable at scale.** 100 handles, and
  cold-DMing from a zero-follower account is both low-yield and a fast route
  to being flagged.
- **Cold email to clubs: the real lever**, and the largest owned channel we
  have. See §6 for the CASL constraint before sending anything.

---

## 2. Zero-follower physics

This decides the whole calendar, and it is the thing most launch plans get
backwards.

| Surface | Reach at 0 followers | Use it for |
|---|---|---|
| **Reels** | Unlimited. Served to non-followers by the recommendation engine. | **Growth. This is the only real discovery surface.** |
| **Feed posts** | Almost none organically. Hashtags and Explore are weak now. | Grid credibility. Somebody who lands on the profile decides in two seconds whether this is real. |
| **Stories** | **Zero. Stories are served to followers only.** | Nothing yet. Stories become useful at a few hundred followers. |

The practical consequence: **do not open with a story.** A story posted today
reaches nobody. Post Reels to be found, keep a tidy grid so the people who
land on the profile follow, and hold stories until there is an audience to
show them to.

---

## 3. Assets that already exist

Worth knowing before making anything new. `scripts/marketing/creatives/` holds
a complete, working pipeline. Render with:

    node scripts/marketing/render-creatives.mjs ~/Desktop/creatives

Everything below renders to **portrait 1080×1350 (feed), story 1080×1920
(Reels/Stories), and square 1080×1080 (carousels)**. ffmpeg is present, so the
video renders too.

**Statics (PNG × 3 formats each):**
`s1-pain-pills` · `s2-name-names` · `s3-checklist` · `s4-hero-tagline` ·
`s5-live-boxscore` · `s6-game-moved` · **`s7-teaser-moved` (new)** ·
**`s8-teaser-census` (new)**

**Animated spots (MP4 × 3 formats + GIF):**
`v1-pills` 8s · `v2-checklist` 7.5s · `v3-livescore` 8s · `v4-headline` 6.5s ·
`v5-game-moved` 8s

**Full 9:16 spots (MP4, story format only):**
`ad-clubs` 26s · `ad-players` 25s

That is 8 statics and 7 video assets, all brand-consistent, before anything
new is authored. **The v-spots are Reels.** They just have not been posted.

The other untapped source: the 13 demo stories in
`apps/web/src/components/demo-directory/stories/`. Screen-record one and it is
a Reel showing the real product, with no generation involved.

---

## 4. The three phases

### Phase 0 — Before the first post (do not skip)

Posting into an empty profile wastes the post. An account with 3 posts and no
bio converts nobody.

- Handle, profile photo, bio with one clear line and the link
- **Post 3 statics on the same day** so a visitor lands on a grid, not a void.
  Use `s8-teaser-census`, `s4-hero-tagline`, `s7-teaser-moved`.
- Link goes to the landing page. Signups are closed (`PUBLIC_SIGNUPS=false`),
  so the destination is the notify form, which is the right ask anyway.

### Phase 1 — Teaser (about a week)

No product. No screenshots. No feature lists. The reveal is what the follow is
for. Alternate feeling and proof so the grid reads as a set:

1. **`s7-teaser-moved`** (dark, feeling): "Your kid's game moved. You heard it
   from another parent. / Not this season."
2. **`s8-teaser-census`** (light, proof): 1,300+ clubs, 11 provinces.
3. One Reel: `v5-game-moved`, 8s, captioned. This is the growth post.
4. A "we are close" post two days before the reveal.

Goal for the week is not thousands. It is a real base of a hundred or two of
the right people, and a profile that looks like a company.

### Phase 2 — Reveal (the weekend)

Feature demos with catchy lines, which is what you asked for and what the
assets are already built for:

- `v3-livescore` → "Every tap at the table, on every phone, instantly."
- `v2-checklist` → the season running itself
- `v1-pills` → the pile of apps it replaces
- Demo screen-recordings for depth: `your-week` (parent), `game-day`
  (scorer's table), `claim-your-club` (clubs)

One Reel a day, each with one idea. Feed posts carry the statics.

### Phase 3 — Clubs (the actual growth lever)

Consumer social is the top of the funnel. Clubs are the distribution. This is
where the 1,001 emails go to work, and where the personalized angle lives.

---

## 5. Ideas worth doing that competitors cannot copy

Ranked by how hard they are to imitate.

**1. "Your club is already on it."** Every one of the 1,300 clubs has a live
page right now. That is not a pitch, it is a gift, and nobody else can send
it. Personalized email with a link to *their* page: "We built this. It is
live. Come claim it." The July doc already names this as the retargeting
hook; it is stronger as the cold-email opener.

**2. Personalized club-page clips at scale.** The page exists for every club,
so a short screen-capture of *their own page* can be generated per club and
attached to the outreach or posted as a tag. A thousand personalized assets is
a thing only somebody holding the census can do.

**3. The census as content.** You hold data nobody else has. "The province
with the most clubs." "The ten biggest programs in Ontario." Clubs share posts
they appear in, which is free distribution from accounts that already have the
audience you want.

**4. Live-score one real game, free.** Offer a league one game covered
end to end, then post the recap and the box score. Creates proof, content and
a reference customer in one weekend.

**5. Founding cohort.** First N clubs get something permanent. Scarcity works
on operators far better than on parents. Owner decides the cap.

**Deliberately not doing:** AI-generated footage of kids playing basketball.
Synthetic children on a platform sold to parents is a trust problem, and the
hands and faces give it away. Anything depicting people stays real
screenshots or licensed photography.

---

## 6. Before any cold email goes out: CASL

Canada's anti-spam law governs commercial electronic messages and the
penalties are real. This is not a reason to avoid the channel, it is a reason
to use it correctly.

CASL recognises **implied consent** where a business address is
*conspicuously published*, is not accompanied by a statement refusing such
messages, and the message is **relevant to the recipient's role or business**.
Club contact addresses published on club websites for exactly this purpose
plausibly fit, and a message about that club's own page on our directory is
about as relevant as it gets.

Requirements either way: identify the sender, give a working postal address
and an unsubscribe that works for at least 60 days, and honour it within 10
business days.

**Owner action:** confirm the approach with counsel before the first send.
`legal@sportshubone.com` exists. Do not bulk-send on my read of the statute.

---

## 7. What is queued for the owner

- Confirm the club count on the **box** so creatives can carry an exact number
  instead of "1,300+".
- Decide the founding-cohort cap (§5.5).
- CASL sign-off before any club email send (§6).
- Instagram handles: 100 exist in `docs/research/raw/`, none are in the DB.
  Worth an importer only if manual outreach is ever wanted; the paid path does
  not need them.
