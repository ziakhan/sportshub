import Link from "next/link"

/** Landing page for one-click email unsubscribe (no login required). */
export default function UnsubscribedPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const status = searchParams.status || "ok"

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      {status === "ok" ? (
        <>
          <div className="bg-court-50 text-court-600 mb-4 grid h-14 w-14 place-items-center rounded-2xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-ink-950 text-2xl font-bold">You&apos;re unsubscribed</h1>
          <p className="text-ink-500 mt-2 text-sm">
            You won&apos;t receive further promotional emails from this organization. Transactional
            messages (receipts, schedule changes for programs you&apos;re registered in) still apply.
          </p>
        </>
      ) : (
        <>
          <div className="bg-hoop-50 text-hoop-600 mb-4 grid h-14 w-14 place-items-center rounded-2xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h1 className="font-display text-ink-950 text-2xl font-bold">
            That link didn&apos;t work
          </h1>
          <p className="text-ink-500 mt-2 text-sm">
            The unsubscribe link is invalid or expired. You can manage every email preference from
            your account settings.
          </p>
        </>
      )}
      <div className="mt-6 flex gap-3">
        <Link
          href="/settings/communications"
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
        >
          Manage email preferences
        </Link>
        <Link
          href="/"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold transition"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
