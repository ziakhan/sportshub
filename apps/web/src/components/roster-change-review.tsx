"use client"

/**
 * The confirm-with-diff dialog for EVERY roster mutation the league makes
 * (owner 2026-07-29: "an Approve button is like blindly clicking on
 * something you don't know"). Shows who comes in, who goes out (with
 * reasons when the league authored them), and the resulting final roster.
 */
export interface RosterChangePreview {
  title: string
  /** e.g. the club's request message, or "League edit" */
  subtitle?: string | null
  additions: string[]
  removals: Array<{ name: string; reason?: string | null }>
  /** Final roster names AFTER the change */
  finalRoster: string[]
  /** Message-only legacy requests: approval unlocks rather than applies */
  unlockOnly?: boolean
  confirmLabel: string
}

export function RosterChangeReviewDialog({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: RosterChangePreview
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-ink-900 text-base font-bold">{preview.title}</h3>
        {preview.subtitle && <p className="text-ink-500 mt-1 text-sm">“{preview.subtitle}”</p>}

        {preview.unlockOnly ? (
          <p className="bg-gold-50 border-gold-100 text-ink-700 mt-3 rounded-lg border px-3 py-2 text-sm">
            This request names no specific players. Approving unlocks the roster so the club can
            make one edit, which then re-locks — you will see the change in the audit trail.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {preview.removals.length > 0 && (
              <div>
                <p className="text-hoop-700 text-xs font-bold uppercase tracking-wide">
                  Coming off ({preview.removals.length})
                </p>
                {preview.removals.map((r, i) => (
                  <p key={i} className="text-ink-800 mt-0.5 text-sm">
                    − {r.name}
                    {r.reason ? <span className="text-ink-500"> — {r.reason}</span> : null}
                  </p>
                ))}
              </div>
            )}
            {preview.additions.length > 0 && (
              <div>
                <p className="text-court-700 text-xs font-bold uppercase tracking-wide">
                  Coming in ({preview.additions.length})
                </p>
                {preview.additions.map((name, i) => (
                  <p key={i} className="text-ink-800 mt-0.5 text-sm">
                    + {name}
                  </p>
                ))}
              </div>
            )}
            <div>
              <p className="text-ink-400 text-xs font-bold uppercase tracking-wide">
                Final roster ({preview.finalRoster.length})
              </p>
              <p className="text-ink-600 mt-0.5 text-sm">{preview.finalRoster.join(", ")}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-ink-600 hover:bg-ink-50 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="bg-court-600 hover:bg-court-700 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Working…" : preview.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
