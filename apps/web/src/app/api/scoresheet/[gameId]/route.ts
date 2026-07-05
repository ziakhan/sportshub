import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit"
import { loadScoresheetData, totalRebounds, type SheetPlayer } from "@/lib/scoring/scoresheet-data"

export const dynamic = "force-dynamic"

/**
 * GET /api/scoresheet/[gameId] — server-generated PDF of the official
 * scoresheet, landscape letter, pure vector (foul boxes and free-throw
 * circles are drawn, not glyphs). Public read, like the HTML sheet —
 * built server-side because mobile-browser printing is unreliable.
 */

const PAGE_W = 792 // letter landscape
const PAGE_H = 612
const M = 28
const GRAY = "#888888"
const LIGHT = "#bbbbbb"

export async function GET(_request: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const data = await loadScoresheetData(params.gameId)
    if (!data) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    const { game, periods, teams, lineScore, periodLabel } = data

    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: M })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))

    let y = M

    // ---------- header ----------
    doc.font("Helvetica-Bold").fontSize(14).fillColor("black")
    doc.text("OFFICIAL SCORESHEET", M, y)
    doc.font("Helvetica").fontSize(8).fillColor("black")
    const headerRight = [
      new Date(game.scheduledAt).toLocaleString(),
      [game.venueName, game.courtName].filter(Boolean).join(" · "),
    ]
      .filter(Boolean)
      .join("\n")
    doc.text(headerRight, PAGE_W - M - 240, y, { width: 240, align: "right" })
    y += 16
    doc.fontSize(9).text([game.leagueName, game.seasonLabel].filter(Boolean).join(" · "), M, y)
    y += 14
    doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(1.5).stroke("black")
    y += 8

    if (!game.final) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#b45309")
      doc.text("UNOFFICIAL — GAME NOT FINALIZED", M, y, { width: PAGE_W - 2 * M, align: "center" })
      doc.fillColor("black")
      y += 16
    }

    // ---------- score + line score ----------
    doc.font("Helvetica-Bold").fontSize(20)
    doc.text(String(game.homeScore), M, y + 6, { width: 60, align: "center" })
    doc.text(String(game.awayScore), PAGE_W - M - 60, y + 6, { width: 60, align: "center" })
    doc.fontSize(9)
    doc.text(game.homeTeamName, M, y + 30, { width: 130 })
    doc.text(game.awayTeamName, PAGE_W - M - 130, y + 30, { width: 130, align: "right" })

    // line score grid centered
    const cols = periods.length + 2 // label + periods + total
    const cw = 44
    const gridW = cw * cols
    const gx = (PAGE_W - gridW) / 2
    const rh = 14
    doc.font("Helvetica").fontSize(7)
    const drawCell = (cx: number, cy: number, text: string, bold = false, align: "center" | "left" = "center") => {
      doc.rect(cx, cy, cw, rh).lineWidth(0.5).stroke(GRAY)
      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
      doc.text(text, cx + 2, cy + 4, { width: cw - 4, align })
    }
    drawCell(gx, y, "", false)
    periods.forEach((p, i) => drawCell(gx + cw * (i + 1), y, periodLabel(p), true))
    drawCell(gx + cw * (cols - 1), y, "F", true)
    const lsRow = (cy: number, name: string, teamId: string, total: number) => {
      drawCell(gx, cy, name.slice(0, 10), true, "left")
      lineScore(teamId).forEach((s, i) => drawCell(gx + cw * (i + 1), cy, String(s)))
      drawCell(gx + cw * (cols - 1), cy, String(total), true)
    }
    lsRow(y + rh, game.homeTeamName, game.homeTeamId, game.homeScore)
    lsRow(y + rh * 2, game.awayTeamName, game.awayTeamId, game.awayScore)
    y += rh * 3 + 12

    // ---------- team blocks ----------
    const qCount = Math.max(periods.length, 1)
    const xNum = M
    const wNum = 26
    const xName = xNum + wNum
    const wName = 118
    const xFouls = xName + wName
    const wFouls = 66
    const xQ = xFouls + wFouls
    const wStats = 32 * 3
    const wQall = PAGE_W - M - xQ - wStats
    const wQ = wQall / qCount
    const xReb = xQ + wQall
    const xAst = xReb + 32
    const xPts = xAst + 32

    const drawFoulBoxes = (cx: number, cy: number, player: SheetPlayer) => {
      const size = 8
      for (let i = 0; i < 5; i++) {
        const bx = cx + i * (size + 3)
        doc.rect(bx, cy, size, size).lineWidth(0.5).stroke("black")
        if (i < player.line.fouls) {
          const isTech = i >= player.line.fouls - player.line.technicalFouls
          if (isTech) {
            doc.font("Helvetica-Bold").fontSize(6).fillColor("black")
            doc.text("T", bx + 1.5, cy + 1, { width: size, lineBreak: false })
          } else {
            doc
              .moveTo(bx + 1, cy + 1)
              .lineTo(bx + size - 1, cy + size - 1)
              .moveTo(bx + size - 1, cy + 1)
              .lineTo(bx + 1, cy + size - 1)
              .lineWidth(0.7)
              .stroke("black")
          }
        }
      }
    }

    // Returns rows-of-marks needed so tall cells can grow the row
    const measureMarkLines = (player: SheetPlayer, p: number): number => {
      const list = player.marks.get(p) ?? []
      if (list.length === 0) return 1
      let x = 0
      let lines = 1
      for (const m of list) {
        const w = m.kind === "ft" ? 8 : 7
        if (x + w > wQ - 6) {
          lines++
          x = 0
        }
        x += w
      }
      return lines
    }

    const drawMarks = (player: SheetPlayer, p: number, cx: number, cy: number) => {
      const list = player.marks.get(p) ?? []
      let x = cx + 3
      let ly = cy
      for (const m of list) {
        const w = m.kind === "ft" ? 8 : 7
        if (x + w > cx + wQ - 3) {
          x = cx + 3
          ly += 9
        }
        if (m.kind === "ft") {
          const r = 2.6
          const circleY = ly + 4
          if (m.made) doc.circle(x + r, circleY, r).fillColor("black").fill()
          else doc.circle(x + r, circleY, r).lineWidth(0.6).stroke(GRAY)
          doc.fillColor("black")
        } else {
          doc.font("Helvetica-Bold").fontSize(7)
          doc.fillColor(m.made ? "black" : LIGHT)
          doc.text(String(m.digit), x, ly + 1, { lineBreak: false })
          if (!m.made) {
            doc.moveTo(x - 0.5, ly + 4.5).lineTo(x + 4.5, ly + 4.5).lineWidth(0.5).stroke(LIGHT)
          }
          doc.fillColor("black")
        }
        x += w
      }
    }

    const ensureRoom = (need: number) => {
      if (y + need > PAGE_H - 70) {
        doc.addPage({ size: "LETTER", layout: "landscape", margin: M })
        y = M
      }
    }

    const teamBlock = (teamName: string, teamId: string, players: SheetPlayer[]) => {
      ensureRoom(40)
      // column header
      doc.font("Helvetica-Bold").fontSize(8).fillColor("black")
      doc.text(teamName.toUpperCase(), xNum, y, {
        width: wNum + wName - 8,
        lineBreak: false,
        ellipsis: true,
      })
      doc.fontSize(6).fillColor(GRAY)
      doc.text("FOULS", xFouls, y + 3)
      periods.forEach((p, i) => doc.text(periodLabel(p), xQ + wQ * i + 3, y + 3))
      doc.text("REB", xReb, y + 3, { width: 30, align: "right" })
      doc.text("AST", xAst, y + 3, { width: 30, align: "right" })
      doc.text("PTS", xPts, y + 3, { width: 30, align: "right" })
      doc.fillColor("black")
      y += 12
      doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(1).stroke("black")
      y += 2

      for (const pl of players) {
        const markLines = Math.max(...periods.map((p) => measureMarkLines(pl, p)), 1)
        const rowH = Math.max(13, markLines * 9 + 4)
        ensureRoom(rowH + 2)
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(pl.status === "absent" ? GRAY : "black")
        doc.text(`#${pl.jersey}`, xNum, y + 3, { width: wNum - 3 })
        doc.font("Helvetica").fontSize(7.5)
        doc.text(pl.name.slice(0, 26), xName, y + 3, { width: wName - 4, lineBreak: false })

        if (pl.status === "played") {
          drawFoulBoxes(xFouls, y + 3, pl)
          periods.forEach((p, i) => drawMarks(pl, p, xQ + wQ * i, y + 2))
          doc.font("Helvetica").fontSize(7.5).fillColor("black")
          doc.text(String(totalRebounds(pl.line)), xReb, y + 3, { width: 30, align: "right", lineBreak: false })
          doc.text(String(pl.line.assists), xAst, y + 3, { width: 30, align: "right", lineBreak: false })
          doc.font("Helvetica-Bold")
          doc.text(String(pl.line.points), xPts, y + 3, { width: 30, align: "right", lineBreak: false })
        } else {
          doc.font("Helvetica").fontSize(6.5).fillColor(GRAY)
          doc.text(pl.status === "absent" ? "ABSENT" : "DNP — DID NOT PLAY", xQ + 3, y + 4, {
            lineBreak: false,
          })
          doc.fillColor("black")
        }
        y += rowH
        doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(0.4).stroke(LIGHT)
        y += 1
      }

      // totals
      const played = players.filter((p) => p.status === "played")
      const tot = played.reduce(
        (t, p) => ({
          pf: t.pf + p.line.fouls,
          reb: t.reb + totalRebounds(p.line),
          ast: t.ast + p.line.assists,
          pts: t.pts + p.line.points,
        }),
        { pf: 0, reb: 0, ast: 0, pts: 0 }
      )
      ensureRoom(14)
      doc.font("Helvetica-Bold").fontSize(7.5)
      doc.text("TOTALS", xNum, y + 2)
      doc.text(`${tot.pf} PF`, xFouls, y + 2)
      periods.forEach((p, i) =>
        doc.text(String(lineScore(teamId)[i] ?? 0), xQ + wQ * i + 3, y + 2, { lineBreak: false })
      )
      doc.text(String(tot.reb), xReb, y + 2, { width: 30, align: "right", lineBreak: false })
      doc.text(String(tot.ast), xAst, y + 2, { width: 30, align: "right", lineBreak: false })
      doc.text(String(tot.pts), xPts, y + 2, { width: 30, align: "right", lineBreak: false })
      y += 13
      doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(1).stroke("black")
      y += 10
    }

    teamBlock(game.homeTeamName, game.homeTeamId, teams.home)
    teamBlock(game.awayTeamName, game.awayTeamId, teams.away)

    // legend
    doc.font("Helvetica").fontSize(6).fillColor(GRAY)
    doc.text(
      "Marks per period in game order: bold 2/3 = made field goal · grey struck 2/3 = missed (where tracked) · filled circle = made free throw · open circle = missed. Foul boxes: X personal, T technical.",
      M,
      y,
      { width: PAGE_W - 2 * M }
    )
    doc.fillColor("black")
    y += 16

    // sign-off
    if (game.final && game.requireRefereeApproval && !game.refereeName) {
      ensureRoom(24)
      doc.rect(M, y, PAGE_W - 2 * M, 18).lineWidth(1.2).stroke("black")
      doc.font("Helvetica-Bold").fontSize(9)
      doc.text("FINALIZED WITHOUT REFEREE APPROVAL", M, y + 5, {
        width: PAGE_W - 2 * M,
        align: "center",
      })
      y += 26
    }

    ensureRoom(34)
    const sigW = (PAGE_W - 2 * M - 40) / 2
    doc.moveTo(M, y + 18).lineTo(M + sigW, y + 18).lineWidth(0.8).stroke("black")
    doc.moveTo(PAGE_W - M - sigW, y + 18).lineTo(PAGE_W - M, y + 18).stroke("black")
    doc.font("Helvetica").fontSize(7)
    doc.text(
      `Referee${game.refereeName ? `: ${game.refereeName}` : ""}${
        game.refereeSignedAt ? ` — signed ${new Date(game.refereeSignedAt).toLocaleString()}` : ""
      }`,
      M,
      y + 21,
      { width: sigW }
    )
    doc.text(
      `Scorekeeper${game.finalizedAt ? ` — finalized ${new Date(game.finalizedAt).toLocaleString()}` : ""}`,
      PAGE_W - M - sigW,
      y + 21,
      { width: sigW }
    )

    doc.end()
    const pdf = await done

    const fname = `scoresheet-${game.homeTeamName}-vs-${game.awayTeamName}`
      .replace(/[^a-z0-9-]+/gi, "-")
      .toLowerCase()
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${fname}.pdf"`,
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    console.error("Scoresheet PDF error:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
