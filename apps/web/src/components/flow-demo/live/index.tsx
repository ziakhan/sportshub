"use client"

import { LivePlayer, type LiveAct } from "./engine"
import { ACT1 } from "./act1-club"
import { ACT2 } from "./act2-tryout"
import { ACT3 } from "./act3-parent"
import { ACT4 } from "./act4-signups"
import { ACT5, ACT6 } from "./act5-accept"
import { ACT_LEAGUE } from "./act6-league"
import { ACT_REGISTER_LEAGUE } from "./act7-register"
import { ACT_SCHEDULE } from "./act8-schedule"
import { ACT_GAMEDAY } from "./act9-gameday"
import { ACT_FINAL } from "./act10-final"
import { ACT_PARENT_GAMEDAY } from "./act-parentday"

const ACTS: LiveAct[] = [
  { id: "club", title: "The club signs up" },
  { id: "tryout", title: "The tryout goes live" },
  { id: "parent", title: "A parent signs up" },
  { id: "signups", title: "Check-in & offers" },
  { id: "accept", title: "The family accepts" },
  { id: "finalize", title: "The team is set" },
  { id: "league", title: "The league opens" },
  { id: "register", title: "Teams enter" },
  { id: "schedule", title: "Schedule & refs" },
  { id: "gameday", title: "Game day, live" },
  { id: "final", title: "Final & the sheet" },
]

export function LiveDemo() {
  return (
    <LivePlayer
      acts={ACTS}
      scenes={[
        ...ACT1,
        ...ACT2,
        ...ACT3,
        ...ACT4,
        ...ACT5,
        ...ACT6,
        ...ACT_LEAGUE,
        ...ACT_REGISTER_LEAGUE,
        ...ACT_SCHEDULE,
        ...ACT_GAMEDAY,
        ...ACT_FINAL,
      ]}
    />
  )
}

/* The parent cut: her whole season, no league office, no scoring console. */
const PARENT_ACTS: LiveAct[] = [
  { id: "parent", title: "Find the tryout" },
  { id: "accept", title: "The offer" },
  { id: "schedule", title: "Your calendar" },
  { id: "pgame", title: "Game day" },
]

export function ParentLiveDemo() {
  const calendarScenes = ACT_SCHEDULE.filter((s) =>
    ["l-notify", "l-calendar", "l-change-alerts", "l-calendar-changes"].includes(s.id)
  )
  return (
    <LivePlayer
      acts={PARENT_ACTS}
      scenes={[...ACT3, ...ACT5, ...calendarScenes, ...ACT_PARENT_GAMEDAY]}
    />
  )
}
