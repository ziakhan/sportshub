---
updated: 2026-08-18
tags: [theme/schema, theme/product, type/plan, status/proposed]
---

# Age bands need one model, and the US makes that urgent

**Owner ruling, 2026-08-18:** *"U10 and grades are exactly representing the same thing. We need to normalize this data across the board and later on even have a better plan for the U.S. because the age works differently in the U.S. than they do in Canada. The U's are sometimes U10 and sometimes 10U."*

Status: **proposed, not started.** This is a schema change and deserves its own go-ahead.

---

## 1. What is actually stored today

`Team.ageGroup` is free text. Counted from the local database:

| Value | Teams | Convention |
|---|---|---|
| Grade 10 | 36 | school |
| Grade 9 | 31 | school |
| Grade 8 | 16 | school |
| U12 | 10 | club, Canadian |
| Grade 7 | 8 | school |
| Grade 11 | 8 | school |
| U15 | 3 | club |
| U17 | 2 | club |
| U14, U16, U18 | 1 each | club |

**Three conventions are already live in one column**, and a fourth is mandated by the copy law (single birth year, Canada). Nothing can group, filter, sort or compare on this field. Any age-first surface has to parse strings, and every consumer parses them slightly differently.

## 2. Why it blocks real work

- **Teams by age** on the club page (studio preview, 2026-08-18) groups on this field. It works within one club only because a club is usually internally consistent. Across clubs it is meaningless.
- **Directory filtering** ("show me clubs running U12 near me") is impossible. This is the single most valuable filter for a parent, and it is the whole point of the discovery layer.
- **League and division alignment** cannot be verified. A team entered as "Grade 9" and a division called "U15" may be the same cohort with no way to know.
- **The US market** breaks it outright. `10U` and `U10` are the same cohort written backwards, and US grade cutoffs do not map to Canadian ones.

## 3. The model

Separate the **cohort** from how it is **written**. The cohort is a fact; the notation is regional presentation.

```prisma
enum AgeBandKind {
  BIRTH_YEAR   // canonical. 2013 = kids born in 2013
  GRADE        // school leagues. 9 = grade 9
  AGE_UNDER    // legacy/import. 12 = under 12
}

model Team {
  ageBandKind  AgeBandKind?
  ageBandValue Int?
  ageGroup     String?   // kept as the free-text original, never read for logic
}
```

**Display is a formatter, not a column.** One function, region aware:

| Cohort | Canada club | US club | School |
|---|---|---|---|
| `AGE_UNDER 12` | U12 | 12U | — |
| `GRADE 9` | Grade 9 | 9th Grade | Grade 9 |
| `BIRTH_YEAR 2013` | 2013 (U12) | 2013 (12U) | — |

Region comes from the tenant's country, so a US club sees `12U` and an Ontario club sees `U12` off the same row. That answers the owner's US point without a second schema.

**Birth year is canonical** because it is the only one that does not drift: a grade rolls over every September and an "under" age rolls over every season, but a birth year is permanent. Grade and under-age are stored as given and mapped to a birth-year range for comparison, never the reverse.

## 4. Migration

1. Add the three fields, nullable. No behaviour change. Additive, so no risk to the box.
2. Backfill by parsing the existing strings. The current data is unambiguous: `^Grade (\d+)$` and `^U(\d+)$` cover every value in use above. Anything unparsed keeps `ageGroup` and gets null bands, so nothing is destroyed.
3. Point consumers at the new fields one at a time, formatter only. `ageGroup` remains for display fallback and for the audit trail of what was originally entered.
4. Only once every consumer is migrated, consider making the fields required on new teams.

**Never overwrite `ageGroup`.** It is what a human typed, and it is the evidence if a parse turns out wrong.

## 5. Open questions for the owner

1. **Cutoff dates.** Canadian basketball uses single birth year (calendar). US club ball commonly uses a 1 September cutoff and grade-based rules. Does a tenant carry its own cutoff rule, or does it follow its country?
2. **Mixed leagues.** A league running both grade-based and birth-year teams needs a comparison rule. Map grades to birth-year ranges, or forbid mixing within a division?
3. **Display default for Canada.** The copy law says single birth year. Does the club page show `2013`, `U12`, or `2013 (U12)`?
4. **Scope.** Team only, or Division and Program too? They have the same problem and the same fix.

## 6. Not in scope here

The club-page grouping shipped in the studio preview groups on the raw string deliberately, so it needs no schema change and is not blocked on this document. This plan is what makes that grouping correct *across* clubs, and what makes the directory filter possible.

⬅ [[business-model-v3]] · [[us-league-targets-2026-08]] · [[design-system-elevation]]
