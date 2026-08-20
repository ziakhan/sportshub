---
updated: 2026-08-19
tags: [theme/marketing, theme/gtm, type/copy, status/ready]
---

# Instagram launch captions — the first eleven posts

Final copy, ready to paste. Creatives live in `scripts/marketing/creatives/`
and render from `/dev/creatives` (the gold button gives you the postable file
at export size).

Companion to [[social-organic-launch-2026-08]] for the strategy behind the
order and the cadence.

---

## The rules these follow

**Voice is "we", the SportsHub team.** Not "I". The two places the singular
was doing real work (grandparents, and the founder's own kid's coach) were
rewritten rather than kept, on the owner's call.

**One ask per post, never two.** Two asks gets you neither. Eight of these ask
for a reply, three ask for the click. Early on you need reach before
conversion means anything, and comments are what buy reach.

**Specific questions beat generic ones.** "Can you relate?" earns a like.
"How many are you using?" earns a number in the comments, and a comment is
worth far more than a like.

**Say it the way the card says it.** Post 9 read "messages" in the caption
while its creative said DMs. Same meaning, but DMs is the word the audience
actually uses, and a caption that paraphrases its own image makes the two feel
like different posts.

**The engagement posts do not repeat the link.** The bio carries it
permanently and every creative already ends on `sportshubone.com` in its
footer, so the domain is on screen either way. Saying it in the caption too
would spend the one ask you get.

**Hashtags go in the caption, not the first comment.** That trick is dead.
Three to six, weighted local, because the near-term market is one province.

Base set for all eleven:

    #youthbasketball #ontariobasketball #gtabasketball #basketballparents

Swap the city tag to match the post. Add `#basketballleague` on 7,
`#basketballtrainer` on 9, `#basketballtryouts` on 10.

---

## 1 · Launching this fall
`s21-launching-this-fall` · **Ask: convert** · the only one that opens on its CTA

> Get early access at sportshubone.com.
>
> We spent two seasons in gyms wishing this existed. It's nearly here.

---

## 2 · Youth basketball. All of it. One app.
`s4-hero-tagline` · **Ask: convert**

> One idea, and we built everything around it: a whole season in one place.
> No app for the schedule, another for the chat, another for the scores.
>
> Launching this fall. Link in bio to save your spot.

---

## 3 · Five apps and a spreadsheet
`s1-pain-pills` · **Ask: reply**

> Ask any club or league how many tools their season runs on. Then watch them
> count on their fingers.
> So we built the one that replaces them all.
>
> How many are you using?

---

## 4 · Your club's website runs itself
`s12-club-website` · **Ask: reply**

> Every club we talk to has a website nobody has time to update. Tryout dates
> from two years ago, still sitting there.
> This one fills itself from the season you're already running.
>
> When was yours last updated?

---

## 5 · One team drops out
`s18-team-drops-out` · **Ask: reply**

> Every season it happens. A team pulls out and the whole weekend shifts.
> A spreadsheet and a group chat is not a schedule.
>
> Can you relate?

---

## 6 · Everyone connected, not just compatible
`s20-everyone-connected` · **Ask: reply**

> The league knows. The club knows. Somehow the parent finds out last.
> So we built it so one change reaches everyone at the same moment.
>
> Who tells you last?

---

## 7 · Schedule the season
`s24-plan-your-season` · **Ask: reply** · add `#basketballleague`

> We've watched organizers lose whole weekends to a spreadsheet.
> Pick your gyms, pick your weekends, and the clubs bring their own teams.
>
> How long does yours take?

---

## 8 · Watch every game live
`s5-live-boxscore` · **Ask: reply**

> You can't be in two gyms at once.
> Your phone can.
>
> How do you split a Saturday?

---

## 9 · Still taking bookings in your DMs
`s23-trainer-bookings` · **Ask: reply** · add `#basketballtrainer`

> Every trainer we know runs their business out of their DMs. 15 of them to
> book one session.
> Put your real availability on a page and let them pick a time.
>
> How many DMs to book a session?

---

## 10 · Twelve kids at tryouts
`s22-fill-your-tryouts` · **Ask: convert** · add `#basketballtryouts`

> A club near us had a dozen kids turn up to tryouts. Good program, good
> coaches. Nobody could find them.
> Your page is already live. It just needs your dates.
>
> Is your club listed? Claim it, link in bio.

---

## 11 · You coach two teams
`s19-coach-two-teams` · **Ask: reply**

> Nobody schedules a coach. They schedule teams, and hope.
>
> Coaches, how many teams this year?

⚠️ This post runs ahead of the feature. The scheduler has no person dimension
today (`lib/scheduler-v2` has no coach or staff reference; `SnapTeam` carries
only id, name, gradeId, style, blackouts, windows), so two teams sharing a
coach can still be placed at the same time. The caption deliberately states
the problem and never claims it is solved. Do not let it drift into "now it
does" until the constraint ships.

---

## Posting notes

**Seed the grid first, then reach.** About nine posts makes a clean 3x3, which
is what a visitor actually judges when they arrive. Post the seed close
together, because nobody is watching yet and the point is the grid, not the
individual posts. Keep the rest back for the cadence after the personal
account starts sending people over.

**Do not collab the seeding posts.** Instagram's Collab puts one post on both
accounts' grids and into both feeds, which is the single biggest lever
available. Spend it once the profile looks real, not while it is being built.
Then collab clubs whenever a club is featured, so their followers see it too.

**Music.** Skip it on the statics; it adds nothing to a still and reads as
trying too hard. On the Reels it matters, since audio is a distribution
signal, but the spots are built sound-off legible so the track is decorative.
Note that business and creator accounts get a restricted music library, so
check which account type is posting before planning around a specific song.

**The ask placement.** Last, right before the hashtags, on every post except
number 1. The first line has to earn attention and an ask has not earned
anything yet.
