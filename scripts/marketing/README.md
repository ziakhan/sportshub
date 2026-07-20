# Ad creatives

Self-contained HTML creatives in `creatives/` (brand tokens in `_brand.css`,
mirrored from the web app palette). Statics are `s*.html`; animated spots are
`v*.html` and expose `window.__seek(ms)` + `window.__duration` so frames render
deterministically.

Render everything (PNG square+story, MP4 square+story, GIF square):

    node scripts/marketing/render-creatives.mjs ~/Desktop/sportshub-ad-creatives

Needs ffmpeg on PATH and playwright (symlinked from scripts/demo). Use
`--only v3,s1` to re-render specific creatives after editing.
