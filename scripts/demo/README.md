# Demo recorder

Automated screen-recording clips of the app for demos ("one hub, never leave").
Silent motion clips with an injected cursor + captions — add voiceover, or use as-is.

## Setup (once)
```
cd scripts/demo && npm install && npx playwright install chromium
```

## Record
Dev server must be running (`npm run dev`, http://localhost:3000).
```
node run.mjs            # record all scenarios
node run.mjs mobile     # only mobile-device scenarios
node run.mjs co-08      # only scenarios whose name contains "co-08"
node generate-index.mjs # build clips/index.html gallery
```
Clips land in `clips/*.webm`; open `clips/index.html` to browse.

## Notes
- Device framing per persona: parents/players → **mobile**, owners/league/e-commerce → **desktop**,
  scoring console → **tablet** (set per scenario in `scenarios.mjs`).
- Sessions are cached per persona (`sessions/*.json`) so authenticated clips start signed-in.
- **IDs in `scenarios.mjs` (`C = {...}`) are the current seed and regenerate on every reseed** —
  refetch them if you re-run `seed-nph-demo.ts`.
- Reset the demo world: `npx tsx scripts/seed-nph-demo.ts` then `npx tsx scripts/enrich-demo-clubs.ts`.
