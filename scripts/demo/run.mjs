import { record } from "./lib.mjs"
import { SCENARIOS } from "./scenarios.mjs"

// Optional substring filter: `node run.mjs co-08` or `node run.mjs mobile`
const filter = process.argv[2]?.toLowerCase()
const list = filter
  ? SCENARIOS.filter((s) => s.name.includes(filter) || s.device === filter)
  : SCENARIOS

console.log(`Recording ${list.length} scenario(s)${filter ? ` (filter: ${filter})` : ""}\n`)
let ok = 0
for (const s of list) {
  const good = await record(s.name, `${s.title} [${s.device}]`, s.run, s.device, s.auth ?? null)
  if (good) ok++
}
console.log(`\nDone: ${ok}/${list.length} clean.`)
