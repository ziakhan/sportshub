# Contact enrichment pass (2026-07-06)

We took the ~110 clubs that had no email/phone (only a social handle, or
nothing) and ran a deep research pass to find publicly-posted organizational
contacts + publicly-listed leadership. Full data: `sheets/contact_enrichment.csv`
(also a tab in the workbook). Org-level, publicly-posted info only — no personal
or minor data.

## Result

| | Before | After enrichment |
|---|---|---|
| Clubs with a direct EMAIL | 82 of 205 (40%) | **~150 (73%)** |
| Reachable (email or phone) | 128 (62%) | **~195 (95%)** |
| Genuinely dark (nothing public) | — | **7** |

Of the ~110 gap clubs: **68 are now reachable by email or phone**, ~35 remain
best-reached by Instagram DM, and **7 could not be resolved at all**.

## Notable resolutions (were blank, now have a real contact)

- **Canada Topflight Academy** → **Thouse@canadatopflight.com / 613-797-2089,
  Tony House (Founder)** — your NJC/NSC friend's own club.
- **Brampton City Prep** → info@bramptoncityprep.com / 416-747-7208
- **Fort Erie International Academy** → info@feia.ca / 647-728-7840 (Principal
  William Cockburn)
- **Scarborough Basketball Association (SBA/Blues)** → info@sbablues.ca /
  416-551-7554 (Sam Moncada, Pres; Darlene Anstice, ED)
- **YNBA (York North)** → admin@ynba.ca / 905-853-9102 (Jason Scott, Founder)
- **TPG Basketball** → thepgba@gmail.com / 647-501-9805 (Alfred Brown, Pres)
- **JUMP Basketball** → Support@JumpBasketball.ca / 647-549-5867
- **MUMBA / "MUMBA Mentality"** → basil@mumbabasketball.ca / 647-945-6945 —
  and CONFIRMED: MUMBA and the "MBA" NPH entries are the SAME Markham org
  (MBA = MUMBA's prep program, GM Samuel Wiseman). This is the ~22-team club.
- Plus resolved names: **SCI Spartans** = Silverthorn CI; **NDL** = Collège
  Notre-Dame-de-Lourdes (Longueuil); **Alma Prep** = Académie d'Alma;
  **Canada Central Prep** = Winnipeg Sport Institute; **North Bay** = North Bay
  Spartans; **Markham Gators** = Gators Basketball Academy.

## Data-hygiene flags (fix in CRM before sending)

- **BALL905:** the domain `ball905rep.com` is HIJACKED — now serves a gambling
  site. Use `ball905.com` / register@ball905.com only.
- **Hodan Prep:** folding after 2025-26 — deprioritize.
- **Victory (Brampton):** a listed phone uses a US (Houston) area code — verify.
- **Compass Academy:** the only "Compass" org is in New Jersey — likely NOT the
  Ontario NJC/NSC team; treat as unmatched.
- Watch same-name US decoys flagged in the CSV notes (Prolific, MC Elite, TLB,
  Victory, K9, Ascend — all have unrelated US orgs).

## Still dark (7 — ask the leagues directly)

Canadian Private School, Compass Academy, EM Elite, Fitz Youth, Ignite Academy,
NSE Select Academy, The Conglomerate. All are league roster entries with no
public web/social footprint — NPH/NJC can identify them from their internal
rosters faster than any search.

## Leadership names captured

~45 clubs now have a named director/founder/president (see the `leader` column).
Use for personalized outreach ("Hi Tony," "Hi Sam") — but the ones sourced from
directories vs. the org's own site are flagged lower-confidence; verify a name
before you put it in an email.
