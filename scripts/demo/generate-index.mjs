import fs from "node:fs"
import path from "node:path"
import { SCENARIOS } from "./scenarios.mjs"

const GROUPS = [
  ["📱  Parents & players — mobile", (s) => s.device === "mobile"],
  ["💻  Club owners & e-commerce — desktop", (s) => s.device === "desktop" && s.name.startsWith("co")],
  ["💻  League — desktop", (s) => s.device === "desktop" && s.name.startsWith("lg")],
  ["📋  Game-day scoring — tablet", (s) => s.device === "tablet"],
]

const card = (s) => {
  const file = `${s.name}.webm`
  const exists = fs.existsSync(path.resolve("clips", file))
  return `
    <figure class="card ${s.device}">
      <video src="${file}" controls preload="metadata" muted></video>
      <figcaption>
        <span class="dev ${s.device}">${s.device}</span>
        <b>${s.title}</b>
        <code>${file}${exists ? "" : " (missing)"}</code>
      </figcaption>
    </figure>`
}

const sections = GROUPS.map(([label, pred]) => {
  const items = SCENARIOS.filter(pred).map(card).join("")
  return `<h2>${label}</h2><div class="grid">${items}</div>`
}).join("\n")

const html = `<!doctype html><meta charset="utf-8"><title>SportsHub demo clips — "One hub, never leave"</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0e0e12;color:#eee;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
  header{padding:28px 32px 8px}
  h1{margin:0 0 4px;font-size:24px}
  header p{margin:0;color:#9a9aa5}
  h2{margin:34px 32px 12px;font-size:16px;color:#c9c9d2;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;padding:0 32px}
  .card{margin:0;background:#17171d;border:1px solid #26262e;border-radius:14px;overflow:hidden}
  .card.mobile{max-width:300px}
  video{width:100%;display:block;background:#000}
  .card.mobile video{max-height:520px;object-fit:contain}
  figcaption{padding:11px 13px;display:flex;flex-direction:column;gap:3px}
  figcaption b{font-weight:600}
  figcaption code{color:#7f7f8c;font-size:12px}
  .dev{align-self:flex-start;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;
       padding:2px 8px;border-radius:999px;margin-bottom:2px}
  .dev.mobile{background:#3b1d5e;color:#d9b8ff}.dev.desktop{background:#0b3b4a;color:#9fe6ff}
  .dev.tablet{background:#4a3a0b;color:#ffe29f}
  footer{padding:28px 32px;color:#77777f;font-size:13px}
</style>
<header>
  <h1>SportsHub — demo clips</h1>
  <p>“One hub, never leave.” Silent motion clips (injected cursor + captions). Add voiceover, or use as-is. Click any clip to play.</p>
</header>
${sections}
<footer>Regenerate: <code>node run.mjs</code> (all) or <code>node run.mjs &lt;filter&gt;</code> · then <code>node generate-index.mjs</code>. IDs are the current seed.</footer>`

fs.writeFileSync(path.resolve("clips", "index.html"), html)
console.log("wrote clips/index.html")
