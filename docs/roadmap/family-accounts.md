# Family Accounts — Parent ↔ Child Linking (SHIPPED 2026-07-24)

Status: **shipped** (web) · Owner questions answered 2026-07-23 overnight · Native screens: backlog

## The model in one paragraph

Every player profile (`Player` row) has up to TWO account links. `parentId` is the **guardian and payer of record** — approvals, registrations, and program fees always run through it. `userId` (new) is the **player's own login** — a 13+ kid who signs in themself sees their teams, games, and stats on the same profile. The two are different concerns and can point at different people; every permission check runs through `canActForPlayer()` which honors both.

## Who starts first? Both orders work now

**Parent-first (the common case)**
1. Parent creates an account, adds the kid at /players/add (any age; under-13 requires the consent checkbox, stamped for COPPA).
2. Everything runs through the parent: registrations, payments, follower approvals.
3. When the kid is 13+, the parent opens the kid's edit page → **Family & login card → "Give <kid> their own login"** → enters the kid's email.
4. Kid gets the email, signs up (or in) with that email, accepts at /family/accept/[token] → their account becomes the profile's `userId`, and they get the Player role. **Payments stay with the parent.** Under-13 invites are refused server-side.

**Player-first (13+ self-signup)**
1. A 13+ player creates their own account and picks "I'm a Player (13+)" at onboarding (under-13 is hard-blocked with "a parent must register you"). Their Player row starts with `parentId = userId = their own id` — they're their own guardian/payer for the moment.
2. On their player edit page the Family & login card offers **"Invite a parent or guardian"** → enters parent's email.
3. Parent signs up/in with that email and accepts → `parentId` flips to the parent. The parent becomes guardian AND payer for **future** fees (existing obligations keep their original payer); the kid keeps their own login.

**Who invites whom:** either side. Parent → kid = CHILD_LOGIN invite. Kid → parent = GUARDIAN invite. Both are `FamilyInvitation` rows (tokenized email links, 14-day expiry, auto-attach at signup exactly like staff invites — signing up with the invited email surfaces the invite instantly).

**Under 13:** can never self-register (onboarding 403), can never receive a CHILD_LOGIN invite (API 400). The parent runs everything until they turn 13 — the card on the edit page says so.

**13+ but parent pays:** that's the default outcome of BOTH flows above — `payerUserId` on every obligation is `Player.parentId`, so as long as a real parent holds `parentId`, the parent is billed no matter who logs in.

## What shipped (implementation map)

- Schema: `Player.userId` (unique, nullable) + `FamilyInvitation` (CHILD_LOGIN | GUARDIAN, PENDING/ACCEPTED/DECLINED/EXPIRED, tokenized).
- `lib/authz/player-scope.ts`: `canActForPlayer`/`guardianUserIds` now honor `userId` too — one seam, every social/share/follow check inherits it.
- APIs: `POST/GET /api/family-invitations`, `GET/PATCH /api/family-invitations/[token]`, `GET /api/players/[id]/family`.
- UI: FamilyCard on players/[id]/edit (state-aware: under-13 copy / invite form / pending state / linked state), /family/accept/[token] page.
- Signup auto-attach + bell notification (`family_invite`, push-enabled).
- Onboarding Player case now sets `userId = own id` alongside `parentId`.

## Handles (same overnight batch)

- `User.handle` (unique): EVERY new account gets a generated default at signup (name → email local-part → numbered), changeable on /account ("Your handle" card, @-prefixed, first come first served). Existing users backfilled by `scripts/backfill-user-handles.ts`.
- Players keep `Player.handle` (/p/<handle>) — the marketable player identity, unchanged.
- Clubs' handle = `Tenant.slug` (unique, picked at creation with name-based suggestion chips, shown as slug.sportshubone.com). Reserved words now include sportshubone/ysportshub/sportshub.

## Deferred / follow-ups

- Co-guardian households (second parentId / split payments) — docs/roadmap/co-guardian-households.md, unchanged.
- Guardian invite entry point on the native app (web-only today).
- A "payer of record" field separate from parentId if divorced-household billing ever needs both parents paying different programs.
- Int tests for the invitation state machine (manual e2e only tonight).
