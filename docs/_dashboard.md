---
tags: [type/reference, moc/dashboard]
---

# 📊 Build Dashboard

Live status of every roadmap plan, auto-generated from the plan docs' frontmatter.
As we build, each plan's `status` flips **planned → in-progress → shipped** and these
tables update themselves — no manual editing.

> **Requires the Dataview plugin** (Settings → Community plugins → search "Dataview" →
> install + enable). Without it these blocks show as code. Snapshot as of 2026-07-08:
> **29 plans — 26 planned · 2 draft · 0 in-progress · 1 shipped.** ✅ [[customizable-pages]] shipped; next: [[club-page-design-polish]] (after restart).

## 🔨 In progress
```dataview
TABLE WITHOUT ID file.link AS Plan, area AS Area, effort AS Effort, updated AS Updated
FROM #type/plan
WHERE status = "in-progress"
SORT updated DESC
```

## ✅ Shipped
```dataview
TABLE WITHOUT ID file.link AS Plan, area AS Area, updated AS Shipped
FROM #type/plan
WHERE status = "shipped"
SORT updated DESC
```

## 📈 Status summary
```dataview
TABLE WITHOUT ID key AS Status, length(rows) AS Count
FROM #type/plan
GROUP BY status
```

---

## 🔴 Tier 0 — before a real (paid, public) launch
```dataview
TABLE WITHOUT ID file.link AS Plan, status AS Status, effort AS Effort, area AS Area, source AS From
FROM #type/plan
WHERE tier = 0
SORT status ASC, effort ASC
```

## 🟠 Tier 1 — core product completeness
```dataview
TABLE WITHOUT ID file.link AS Plan, status AS Status, effort AS Effort, area AS Area, source AS From
FROM #type/plan
WHERE tier = 1
SORT status ASC, effort ASC
```

## 🟡 Tier 2 — parity & operations
```dataview
TABLE WITHOUT ID file.link AS Plan, status AS Status, effort AS Effort, area AS Area, source AS From
FROM #type/plan
WHERE tier = 2
SORT status ASC, effort ASC
```

## ⚪ Tier 3 — differentiators / later
```dataview
TABLE WITHOUT ID file.link AS Plan, status AS Status, effort AS Effort, area AS Area
FROM #type/plan
WHERE tier = 3
SORT status ASC
```

---

## By area
```dataview
TABLE WITHOUT ID key AS Area, length(rows) AS Plans, filter(rows.status, (s) => s = "shipped").length AS Shipped
FROM #type/plan
GROUP BY area
SORT length(rows) DESC
```

⬅ [[Home]] · [[requirements-map|Requirements Map]] · [[coverage-audit|Coverage Audit]] · [[_moc-shipped|What's Built]]
