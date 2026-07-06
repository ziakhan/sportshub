"use client"

export function DownloadOrderCsv({
  filename,
  header,
  rows,
}: {
  filename: string
  header: string[]
  rows: (string | number | null)[][]
}) {
  function handleDownload() {
    const escape = (v: string | number | null) => {
      const s = v === null || v === undefined ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2 text-sm font-semibold transition"
    >
      Download CSV
    </button>
  )
}
