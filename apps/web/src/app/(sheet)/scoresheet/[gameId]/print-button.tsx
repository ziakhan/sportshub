"use client"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
    >
      Print / Save as PDF
    </button>
  )
}
