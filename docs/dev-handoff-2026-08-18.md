# Dev Handoff — 2026-08-18

Owner-raised items for the developers. Not implemented here; this is the
written record so nothing gets lost.

---

## 1. Club review console — capture a real street address, and make it usable for "find a club near me"

**Raised by:** owner, 2026-08-18
**Surface:** `/dashboard/admin/clubs/lifecycle` ("Club review" in the admin nav)
**Priority:** high — blocks proximity search from working at all

### What the owner asked for

> When you're in the club review and editing information, we want a field for a
> direct address, so that when families say "find a club near me" it matches on
> an actual address near them and not just a city. A city is too coarse — people
> want the clubs that are genuinely close to them.

### What already exists (do not rebuild these)

Most of the plumbing is already in place. This is smaller than it looks:

- **`Tenant` schema already has the fields**: `address`, `city`, `state`,
  `zipCode`, `postalCode`, `country`, plus `latitude`, `longitude`, `placeId`,
  `geocodedAt`, `geoSource`, `geoPrecision`.
- **The admin edit API already accepts `address`, `latitude` and `longitude`.**
  See `editSchema` in `apps/web/src/app/api/admin/clubs/lifecycle/route.ts`.
- The API already marks hand-entered coordinates as `geoSource: "manual"` so a
  later re-geocode won't silently overwrite a human correction. Keep that.

### The actual gaps

**A. The edit form doesn't expose `address`.**
`apps/web/src/app/(platform)/dashboard/admin/clubs/lifecycle/console.tsx` only
renders: `name`, `city`, `state`, `region`, `contactEmail`, `phoneNumber`,
`website`. The API would accept `address` today — the input is simply missing
from the form. This is the literal thing the owner asked for and it is roughly
a one-field change.

**B. `postalCode` is missing from the edit schema entirely.**
It is on the model but not in `editSchema`, so it cannot be edited at all. For
Canadian proximity this is arguably the highest-value field — a postal code
geocodes tighter than a street address and families know their own.

**C. Nothing geocodes on save. This is the important one.**
Proximity search needs `latitude`/`longitude`. Today those are only set when an
admin types coordinates by hand. Typing a street address does nothing for
search. The chain has to be:

> address / postal code → geocode → lat + lng → distance query

Without the middle step, adding the address field satisfies the request as
worded but does **not** make "find a club near me" work. Options, in order of
preference:

1. Geocode on save in the edit action (address or postal changed → geocode →
   store lat/lng + `geocodedAt` + `geoSource: "google"`). Best UX; the admin
   sees it resolve immediately.
2. Queue for the existing batch geocoder (`scripts/research/geocode-clubs.py`)
   and surface a "not geocoded yet" state in the console so it is visible.
3. Manual lat/lng entry only — already possible, but doesn't scale to a census
   import of hundreds of clubs.

Whichever is chosen, the console should **show geocode status per club**.
Admins otherwise have no way to know a club will never appear in a nearby
search.

**D. Current data coverage is zero.**
Checked against the local database on 2026-08-18: **88 tenants, 0 with
latitude/longitude, 0 with an address.** So even once the field ships, nothing
appears in proximity results until the existing clubs are backfilled. Whoever
picks this up should plan the backfill as part of the work, not after it.

### Definition of done

- [ ] `address` input in the club review edit form
- [ ] `postalCode` added to `editSchema` and the form
- [ ] Address/postal change triggers geocoding; `lat`/`lng`/`geocodedAt`/
      `geoSource` populated
- [ ] Hand-entered coordinates still win over geocoded ones (`geoSource:
      "manual"` preserved)
- [ ] Geocode status visible per club in the console
- [ ] Existing clubs backfilled, or a clear plan for it
- [ ] `/club` search returns results ordered by real distance, verified against
      a known address

### Note on the search side

`apps/web/src/lib/queries/directory-clubs.ts` already contains distance-related
code. Worth confirming whether it is wired to the public club search before
building anything new — the query layer may already be waiting on the data.

---

## Deploy status note (2026-08-18)

The club review console landed today in `dce4eaf5`. The owner was told it would
be on the live server and could not find it. It is **in master and works
locally**, but Vercel git deploys have been disabled since 2026-07-24, so
pushing to GitHub deploys nothing — the live site only changes when the box
deploy script is run, and that is owner-authorised. If the owner is expected to
test something on live, someone has to run the deploy and say so.

Also worth knowing: the console is linked in the admin nav as **"Club review"**,
not as anything containing "edit" or "merge". That naming is why it was missed.
Consider whether the label communicates that merging and editing live there.
