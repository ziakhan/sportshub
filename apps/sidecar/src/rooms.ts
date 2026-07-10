/**
 * Room authorization — the security boundary of the socket layer.
 *
 * PUBLIC rooms carry data the website already shows anonymously (scores,
 * live game events, league scoreboards). Anyone may join.
 *
 * PRIVATE rooms carry member-only data (team chat involves minors; user
 * rooms carry personal notifications). Joinable ONLY when the socket's
 * verified ticket/bearer claims list the exact room. The web app decides
 * membership (it has the DB); the sidecar only enforces the claim.
 */
const PUBLIC_ROOM = /^(scores|game:[\w-]+|league:[\w-]+:scores)$/
const PRIVATE_ROOM = /^(team:[\w-]+|user:[\w-]+)$/

export function isPublicRoom(room: string): boolean {
  return PUBLIC_ROOM.test(room)
}

export function canJoin(room: string, claimedRooms: readonly string[] | null): boolean {
  if (isPublicRoom(room)) return true
  if (!PRIVATE_ROOM.test(room)) return false // unknown shape → deny
  return claimedRooms !== null && claimedRooms.includes(room)
}
