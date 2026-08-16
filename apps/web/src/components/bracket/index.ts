// Playoff brackets, drawn as real tournament trees. Import from
// "@/components/bracket" on every surface — operator and public alike.
export {
  BracketBoard,
  BracketLegend,
  BracketPools,
  BracketTree,
  MatchCard,
  type Scale as BracketScale,
} from "./bracket-tree"
export {
  sectionizeBracket,
  type BracketMatch,
  type BracketSection,
  type BracketSectionKind,
  type BracketSlot,
  type BracketSlotKind,
} from "./types"
