---
updated: 2026-07-06
tags: [theme/research, type/research, status/reference]
---

# NJC / NSC 2025-26 Team-Entry Census (TeamLinkt API) — raw census

> Pulled 2026-07-06 from the circuits' own TeamLinkt endpoints (no auth):
> team lists via `POST nationaljrcircuit.com/leagues/getTeams/27543/43098`
> (season_id=43098 "2025-26") and `POST nationalsrcircuit.com/leagues/getTeams/27544/43096`;
> rosters via `POST leagues.teamlinkt.com/leagues/getTeamRosterForDatatable/{assoc}/{team_id}/1`.
> Playoff-bracket placeholders excluded (NJC 14, NSC 6).

## Team entries by club/program

| Club/Program | NJC | NSC | Entry names |
|---|---|---|---|
| 506 Elite Jr Academy | 1 | 0 | NJC: 506 Elite Jr Academy |
| Against The Six Prep | 1 | 0 | NJC: Against The Six Prep |
| Alpha Elite | 1 | 0 | NJC: Alpha Elite |
| Brampton City Prep | 2 | 1 | NJC: BCP North, BCP South · NSC: BCP Regional |
| Brotherhood Elite | 0 | 1 | NSC: Brotherhood Elite |
| C.O.D.E Academy | 1 | 0 | NJC: C.O.D.E Academy |
| Cali Prep | 1 | 1 | NJC: Cali Prep Red · NSC: CALI Prep |
| Canada Topflight Academy | 1 | 0 | NJC: Canada Topflight Academy |
| City Above Elite | 1 | 0 | NJC: City Above Elite |
| CKATT | 1 | 0 | NJC: CKATT 2010 |
| Collective Elite Academy | 1 | 0 | NJC: Collective Elite Academy |
| Compass Academy | 1 | 1 | NJC: Compass Junior Academy · NSC: Compass Senior Academy |
| Cooksville We>Me | 1 | 0 | NJC: Cooksville We>Me 2030 |
| Dynamic Basketball | 0 | 1 | NSC: Dynamic Basketball |
| Eastern Basketball Academy | 1 | 0 | NJC: Eastern Basketball Academy |
| Elton Academy | 0 | 1 | NSC: Elton Academy |
| F.O.R.M. Basketball Academy | 0 | 1 | NSC: F.O.R.M. Team Gold (National) |
| Full Circle Basketball Academy | 1 | 1 | NJC + NSC: Full Circle Basketball Academy |
| Future Hope Academy | 1 | 0 | NJC: Future Hope Academy |
| G2S Game Changers | 1 | 0 | NJC: G2S Game Changers |
| Gators Basketball Academy | 0 | 1 | NSC: Gators Basketball Academy |
| GBU | 0 | 1 | NSC: GBU |
| HQ Prep | 2 | 0 | NJC: HQ Prep Black, HQ Prep Grey |
| Ignite Academy | 1 | 0 | NJC: Ignite Academy |
| Jungle Prep | 1 | 1 | NJC: Jungle Prep · NSC: Jungle Prep (Regional) |
| Kings Court Academy | 1 | 0 | NJC: Kings Court Academy |
| LBA | 1 | 1 | NJC: LBA JR Provincial · NSC: LBA SR Provincial |
| London Ramblers | 2 | 0 | NJC: Ramblers Blue (U15/U16), Ramblers Red (U16) |
| M&R Basketball | 0 | 1 | NSC: M&R Basketball |
| Monarchs | 0 | 1 | NSC: Monarchs |
| NSE Select Academy | 1 | 0 | NJC: NSE Select Academy |
| ONL-X | 1 | 1 | NJC: ONL-X Junior · NSC: ONL-X RISE |
| Orangeville Prep | 0 | 1 | NSC: Orangeville Prep Varsity |
| Project Excellence | 1 | 1 | NJC + NSC: Project excellence |
| RSB Elite | 1 | 0 | NJC: RSB Elite |
| RWI519 | 1 | 0 | NJC: RWI519 |
| SBA Premier | 1 | 1 | NJC: SBA Premier Blue · NSC: SBA Premier |
| SC Academy Prep | 1 | 2 | NJC: SC Academy Prep · NSC: SC Academy Prep, SC Academy Prep Black |
| SCI Spartans | 1 | 0 | NJC: SCI Spartans |
| Simcoe United | 2 | 2 | NJC: Gr 9, Gr 10 · NSC: Gr 11, Gr 12 |
| SSF Blizzard | 2 | 1 | NJC: SSF Blizzard, SSF Blizzard White · NSC: SSF Blizzard |
| Ste Cecile Academy | 0 | 1 | NSC: Ste Cecile Academy |
| Strive Hoops | 1 | 0 | NJC: Strive Hoops |
| Team Sanctuary | 1 | 0 | NJC: Team Sanctuary |
| Team Thetford | 0 | 1 | NSC: Team Thetford |
| Top Left | 1 | 0 | NJC: Top Left |
| Top Notch Prep | 2 | 0 | NJC: TNP JVR, TNP Rusty |
| Toronto Lords | 0 | 1 | NSC: Toronto Lords Senior Prep Academy |
| Tri-City Prep | 1 | 0 | NJC: Tri-City Prep |
| Triple Balance | 0 | 1 | NSC: Triple Balance-Courtenay/Nick |
| Tru Balance | 1 | 0 | NJC: Tru Balance |
| UEWB | 1 | 0 | NJC: UEWB |
| Vanguard (North) | 1 | 2 | NJC: Vanguard Junior Prep · NSC: Vanguard North U17, Vanguard North Sr Prep |
| Westfield Prep | 1 | 1 | NJC + NSC: Westfield prep |
| Wiggins Elite | 2 | 1 | NJC: G10 Prep A, G10 Prep B · NSC: G11 Prep |
| William Academy | 1 | 0 | NJC: William Academy |
| Wolverines Elite | 1 | 1 | NJC: Wolverines Elite · NSC: Wolverines Elite Sr |

## Summary

- **NJC: 51 real team entries / 44 clubs** (65 raw rows − 14 placeholders).
- **NSC: 32 real team entries / 29 clubs** (38 raw − 6 placeholders).
- **Combined: 83 paying entries, 57 distinct programs, 16 in both circuits.**
- Multi-entry within one circuit: NJC ×2 — BCP, HQ Prep, London Ramblers,
  Simcoe United, SSF Blizzard, Top Notch, Wiggins; NSC ×2 — SC Academy,
  Simcoe United, Vanguard North.
- Biggest combined footprints: Simcoe United 4; BCP, SSF Blizzard, Wiggins,
  Vanguard, SC Academy 3 each.

## Rosters (counted, no names collected)

| | Teams | Players | Avg/team | Range | Avg staff |
|---|---|---|---|---|---|
| NJC | 51 | 619 | 12.1 | 8–16 | 1.5 |
| NSC | 32 | 408 | 12.8 | 9–20 | 1.2 |
| Combined | 83 | **1,027** | **12.4** | 8–20 | 1.4 |

## Judgment calls / caveats

- Vanguard Junior Prep (NJC) grouped with Vanguard North (NSC) — probable, unconfirmed.
- Tru Balance vs Triple Balance kept separate despite similar names.
- "Project excellence" identical in both circuits — assumed one program.
- 2026-27 season IDs exist (57936/57937) but rosters unpopulated — 2025-26 used.
- Reconciliation vs earlier "48/31 clubs": same raw entries, different merge strictness; entry counts (51/32) are the solid pricing numbers.
