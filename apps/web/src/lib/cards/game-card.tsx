import React from "react"
import { ImageResponse } from "next/og"
import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName } from "@/lib/privacy/names"

/**
 * Shareable landscape player cards (social-feed-plan P2), rendered on demand
 * from verified game data — no stored images. Left half = player (photo only
 * with mediaConsent GRANTED, else jersey circle) + stat line; right half =
 * the final score. `templateId` picks the design (bold | clean); the
 * watermark + /p/<handle> burn-in is the unpaid-distribution loop.
 */

export type CardTemplate = "bold" | "clean"

const W = 1200
const H = 630

const TEMPLATES: Record<
  CardTemplate,
  { leftBg: string; leftFg: string; eyebrow: string; accent: string; rightBg: string; rightFg: string; sub: string }
> = {
  bold: {
    leftBg: "linear-gradient(135deg, #1e2d4d 0%, #0b1628 100%)",
    leftFg: "#ffffff",
    eyebrow: "#fbbf24",
    accent: "#f59e0b",
    rightBg: "#ffffff",
    rightFg: "#0f172a",
    sub: "#64748b",
  },
  clean: {
    leftBg: "linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)",
    leftFg: "#0f172a",
    eyebrow: "#4f46e5",
    accent: "#4f46e5",
    rightBg: "#0f172a",
    rightFg: "#ffffff",
    sub: "#94a3b8",
  },
}

export function parseTemplate(value: string | null): CardTemplate {
  return value === "clean" ? "clean" : "bold"
}

/**
 * Render overrides carried by a shared story/post (?src=story:<id>|post:<id>):
 * the chosen template plus the one custom-photo slot. The photo only renders
 * when it passed the AI pre-screen AND the player's mediaConsent is GRANTED.
 * Unknown/invalid src just falls back to defaults — never an error.
 */
export async function loadShareOverrides(
  src: string | null
): Promise<{ templateId?: CardTemplate; customPhotoUrl?: string }> {
  if (!src) return {}
  const [kind, id] = src.split(":")
  if (!id) return {}

  if (kind === "story") {
    const story = await (prisma as any).story.findUnique({
      where: { id },
      select: {
        templateId: true,
        customPhotoUrl: true,
        photoScreenState: true,
        player: { select: { mediaConsent: true } },
      },
    })
    if (!story) return {}
    return {
      ...(story.templateId ? { templateId: parseTemplate(story.templateId) } : {}),
      ...(story.customPhotoUrl &&
      story.photoScreenState === "APPROVED" &&
      story.player?.mediaConsent === "GRANTED"
        ? { customPhotoUrl: story.customPhotoUrl }
        : {}),
    }
  }

  if (kind === "post") {
    const post = await (prisma as any).post.findUnique({
      where: { id },
      select: {
        templateId: true,
        customPhotoUrl: true,
        photoScreenState: true,
        tags: { where: { playerId: { not: null } }, select: { player: { select: { mediaConsent: true } } }, take: 1 },
      },
    })
    if (!post) return {}
    const consent = post.tags[0]?.player?.mediaConsent === "GRANTED"
    return {
      ...(post.templateId ? { templateId: parseTemplate(post.templateId) } : {}),
      ...(post.customPhotoUrl && post.photoScreenState === "APPROVED" && consent
        ? { customPhotoUrl: post.customPhotoUrl }
        : {}),
    }
  }

  return {}
}

interface CardData {
  eyebrow: string
  name: string
  jersey: string | null
  photoUrl: string | null
  statLine: Array<{ label: string; value: number }>
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  contextLine: string
  handle: string | null
}

function statChip(label: string, value: number, t: (typeof TEMPLATES)["bold"]) {
  return (
    <div
      key={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 22px",
        borderRadius: 18,
        background: "rgba(148, 163, 184, 0.18)",
      }}
    >
      <span style={{ fontSize: 44, fontWeight: 800 }}>{value}</span>
      <span style={{ fontSize: 20, fontWeight: 600, color: t.eyebrow }}>{label}</span>
    </div>
  )
}

export function renderCard(data: CardData, template: CardTemplate, portrait = false) {
  const t = TEMPLATES[template]
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", width: portrait ? 1080 : W, height: portrait ? 1350 : H, fontFamily: "sans-serif" }}>
        {/* Left: the player */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: portrait ? "100%" : 560,
            flexGrow: portrait ? 1 : 0,
            padding: "0 48px",
            background: t.leftBg,
            color: t.leftFg,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: t.eyebrow }}>
            {data.eyebrow.toUpperCase()}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 24 }}>
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.photoUrl}
                alt=""
                width={170}
                height={170}
                style={{ borderRadius: 999, objectFit: "cover", border: `6px solid ${t.accent}` }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 170,
                  height: 170,
                  borderRadius: 999,
                  background: t.accent,
                  color: "#ffffff",
                  fontSize: 64,
                  fontWeight: 800,
                }}
              >
                {data.jersey ? `#${data.jersey}` : "🏀"}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span
                style={{
                  fontSize: data.name.length > 14 ? 42 : 52,
                  fontWeight: 800,
                  lineHeight: 1.1,
                }}
              >
                {data.name}
              </span>
              {data.jersey && data.photoUrl && (
                <span style={{ fontSize: 30, fontWeight: 700, color: t.eyebrow }}>#{data.jersey}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 36 }}>
            {data.statLine.map((s) => statChip(s.label, s.value, t))}
          </div>
          {data.handle && (
            <span style={{ fontSize: 24, fontWeight: 600, marginTop: 34, color: t.eyebrow }}>
              sportshubone.com/p/{data.handle}
            </span>
          )}
        </div>

        {/* Right: the final */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            background: t.rightBg,
            color: t.rightFg,
          }}
        >
          <span
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 6,
              padding: "8px 28px",
              borderRadius: 999,
              background: t.accent,
              color: "#ffffff",
            }}
          >
            FINAL
          </span>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, width: 480 }}>
            {(
              [
                [data.homeName, data.homeScore, data.homeScore >= data.awayScore],
                [data.awayName, data.awayScore, data.awayScore >= data.homeScore],
              ] as Array<[string, number, boolean]>
            ).map(([name, score, won], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 0",
                  borderBottom: i === 0 ? `2px solid ${t.sub}33` : "none",
                }}
              >
                <span
                  style={{
                    fontSize: name.length > 18 ? 28 : 36,
                    fontWeight: won ? 800 : 600,
                    opacity: won ? 1 : 0.65,
                    maxWidth: 360,
                  }}
                >
                  {name}
                </span>
                <span style={{ fontSize: 64, fontWeight: 800, opacity: won ? 1 : 0.65 }}>{score}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 22, color: t.sub, marginTop: 28 }}>{data.contextLine}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 40 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>
              Sports<span style={{ color: t.accent }}>Hub</span> One
            </span>
          </div>
        </div>
      </div>
    ),
    { width: portrait ? 1080 : W, height: portrait ? 1350 : H }
  )
}

/** Score-only card (?variant=score): the final for games with or without a
 *  POTG — used by system final posts in the feed so they read as a SCORE,
 *  not a second player card (owner 2026-07-23: "why 2 POTG badges"). */
export async function renderScoreCard(gameId: string, template: CardTemplate, portrait = false) {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      status: true, scheduledAt: true, homeScore: true, awayScore: true,
      homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      season: { select: { label: true, league: { select: { name: true } } } },
    },
  })
  if (!game || game.status !== "COMPLETED") return null
  const t = TEMPLATES[template]
  const rows: Array<[string, number, boolean]> = [
    [game.homeTeam.name, game.homeScore ?? 0, (game.homeScore ?? 0) >= (game.awayScore ?? 0)],
    [game.awayTeam.name, game.awayScore ?? 0, (game.awayScore ?? 0) >= (game.homeScore ?? 0)],
  ]
  const context = [
    game.season?.league?.name, game.season?.label,
    new Date(game.scheduledAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }),
  ].filter(Boolean).join(" · ")
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          width: portrait ? 1080 : W, height: portrait ? 1350 : H, background: t.leftBg, color: t.leftFg, fontFamily: "sans-serif",
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 6, padding: "10px 32px", borderRadius: 999, background: t.accent, color: "#ffffff" }}>
          FINAL
        </span>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, width: 760 }}>
          {rows.map(([name, score, won], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: i === 0 ? `2px solid ${t.sub}44` : "none" }}>
              <span style={{ fontSize: name.length > 20 ? 38 : 46, fontWeight: won ? 800 : 600, opacity: won ? 1 : 0.65 }}>{name}</span>
              <span style={{ fontSize: 84, fontWeight: 800, opacity: won ? 1 : 0.65, color: won ? t.eyebrow : undefined }}>{score}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 24, color: t.sub, marginTop: 34 }}>{context}</span>
        <span style={{ fontSize: 26, fontWeight: 800, marginTop: 30 }}>
          Sports<span style={{ color: t.accent }}>Hub</span> One
        </span>
      </div>
    ),
    { width: portrait ? 1080 : W, height: portrait ? 1350 : H }
  )
}

/** Load everything a card needs for one player in one game; null = 404. */
export async function loadCardData(
  gameId: string,
  playerId: string,
  eyebrow: string
): Promise<CardData | null> {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { select: { label: true, league: { select: { name: true } } } },
      potgPlayerId: true,
      potgPhotoUrl: true,
    },
  })
  if (!game || game.status !== "COMPLETED") return null

  const [player, stat, teamPlayer] = await Promise.all([
    (prisma as any).player.findUnique({
      where: { id: playerId },
      select: { firstName: true, lastName: true, mediaConsent: true, handle: true },
    }),
    (prisma as any).playerStat.findUnique({
      where: { gameId_playerId: { gameId, playerId } },
      select: { points: true, rebounds: true, assists: true },
    }),
    (prisma as any).teamPlayer.findFirst({
      where: { playerId, teamId: { in: [game.homeTeamId, game.awayTeamId] } },
      select: { jerseyNumber: true },
    }),
  ])
  if (!player || !stat) return null

  const consent = player.mediaConsent === "GRANTED"
  const isPotg = game.potgPlayerId === playerId
  return {
    eyebrow,
    name: publicPlayerName(player),
    jersey: teamPlayer?.jerseyNumber != null ? String(teamPlayer.jerseyNumber) : null,
    // The table-side POTG photo rides only on the POTG card, only with consent
    photoUrl: isPotg && consent ? (game.potgPhotoUrl ?? null) : null,
    statLine: [
      { label: "PTS", value: stat.points },
      { label: "REB", value: stat.rebounds },
      { label: "AST", value: stat.assists },
    ],
    homeName: game.homeTeam.name,
    awayName: game.awayTeam.name,
    homeScore: game.homeScore ?? 0,
    awayScore: game.awayScore ?? 0,
    contextLine: [
      game.season?.league?.name,
      game.season?.label,
      new Date(game.scheduledAt).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    ]
      .filter(Boolean)
      .join(" · "),
    handle: player.handle ?? null,
  }
}
