import { describe, expect, it } from "vitest"
import { buildAccountingReport, transactionsToCsv, programLabel } from "./reports"

const ob = (over: any) => ({
  id: over.id ?? "o1",
  description: over.description ?? "Camp fee",
  amount: over.amount,
  currency: "CAD",
  status: over.status,
  createdAt: "2026-07-01T00:00:00.000Z",
  referenceType: over.referenceType ?? "CampSignup",
  payerName: over.payerName ?? "Pat Parent",
  payments: over.payments ?? [],
})

const pay = (over: any) => ({
  id: over.id ?? "p1",
  amount: over.amount,
  status: over.status ?? "SUCCEEDED",
  method: over.method ?? "STRIPE",
  note: null,
  refundAmount: over.refundAmount ?? null,
  createdAt: over.createdAt ?? "2026-07-02T00:00:00.000Z",
  recordedBy: null,
})

describe("buildAccountingReport", () => {
  it("computes collected / outstanding / waived + per-program + transactions", () => {
    const r = buildAccountingReport([
      ob({ amount: 100, status: "PAID", payments: [pay({ amount: 100 })] }),
      ob({ id: "o2", amount: 200, status: "PARTIALLY_PAID", payments: [pay({ id: "p2", amount: 50 })] }),
      ob({ id: "o3", amount: 80, status: "WAIVED", referenceType: "TryoutSignup", payments: [] }),
      ob({
        id: "o4",
        amount: 120,
        status: "PAID",
        referenceType: "HouseLeagueSignup",
        payments: [pay({ id: "p4", amount: 120, refundAmount: 20 })],
      }),
    ] as any)

    expect(r.totals.collected).toBe(100 + 50 + 100) // o4 net = 120-20
    expect(r.totals.outstanding).toBe(150) // o2: 200-50
    expect(r.totals.waived).toBe(80)

    const camps = r.byProgram.find((p) => p.referenceType === "CampSignup")!
    expect(camps.collected).toBe(150) // o1 100 + o2 50
    expect(camps.count).toBe(2)
    expect(r.byProgram.find((p) => p.label === "House Leagues")!.collected).toBe(100)

    // 3 real payments become transactions (waived o3 has none)
    expect(r.transactions).toHaveLength(3)
    const hl = r.transactions.find((t) => t.program === "House Leagues")!
    expect(hl.net).toBe(100)
    expect(hl.refund).toBe(20)
  })

  it("programLabel maps known types and prettifies unknown", () => {
    expect(programLabel("CampSignup")).toBe("Camps")
    expect(programLabel("TeamSubmission")).toBe("League Team Fees")
    expect(programLabel("SomethingElse")).toBe("Something Else")
  })

  it("CSV has a header + one row per transaction, escaping commas", () => {
    const r = buildAccountingReport([
      ob({ amount: 100, status: "PAID", payerName: "Smith, Jamie", payments: [pay({ amount: 100 })] }),
    ] as any)
    const csv = transactionsToCsv(r)
    const lines = csv.split("\n")
    expect(lines[0]).toContain("Date,Payer,Program")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"Smith, Jamie"') // comma-safe quoting
  })
})
