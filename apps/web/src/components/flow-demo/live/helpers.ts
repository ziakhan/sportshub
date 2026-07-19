import type { Step } from "./engine"

/** Open a dropdown, walk to the choice, select it. */
export const pick = (id: string, key: string, hi: number, label: string): Step[] => [
  { press: id },
  { set: { [`${key}:open`]: true } },
  { wait: 520 },
  { set: { [`${key}:hi`]: hi } },
  { wait: 420 },
  { set: { [key]: label, [`${key}:open`]: false } },
  { wait: 260 },
]

/** Move to a field and type into it. */
export const typeIn = (id: string, key: string, text: string, cps?: number): Step[] => [
  { cursor: id },
  { type: [key, text], cps },
  { wait: 160 },
]

/** Tick a checkbox. */
export const tick = (id: string, key: string): Step[] => [
  { press: id },
  { set: { [key]: true } },
  { wait: 220 },
]
