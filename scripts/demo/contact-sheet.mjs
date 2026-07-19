import { chromium } from "playwright"
const files = ["public-scores", "public-leagues", "phone-calendar", "phone-chat", "phone-kids"]
const html = `<body style="margin:0;background:#ddd;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px">` +
  files.map((f) => `<div><div style="font:700 12px sans-serif;padding:2px">${f}</div><img src="file:///Users/ziakhan/zia/personal/sportshub/apps/web/public/shots/${f}.png" style="width:100%"></div>`).join("") + `</body>`
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1600, height: 1400 } })).newPage()
await p.setContent(html)
await p.waitForTimeout(1500)
await p.screenshot({ path: "/tmp/contact-sheet.png", fullPage: true })
await b.close()
console.log("sheet ready")
