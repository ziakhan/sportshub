"use client"

import { LivePlayer, type LiveAct } from "./engine"
import { ACT1 } from "./act1-club"
import { ACT2 } from "./act2-tryout"
import { ACT3 } from "./act3-parent"
import { ACT4 } from "./act4-signups"
import { ACT5, ACT6 } from "./act5-accept"

const ACTS: LiveAct[] = [
  { id: "club", title: "The club signs up" },
  { id: "tryout", title: "The tryout goes live" },
  { id: "parent", title: "A parent signs up" },
  { id: "signups", title: "Check-in & offers" },
  { id: "accept", title: "The family accepts" },
  { id: "finalize", title: "The team is set" },
]

export function LiveDemo() {
  return <LivePlayer acts={ACTS} scenes={[...ACT1, ...ACT2, ...ACT3, ...ACT4, ...ACT5, ...ACT6]} />
}
