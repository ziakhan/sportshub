import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mesh-surface relative min-h-screen overflow-hidden bg-[#fafafa]">
      <div className="bg-play-200/60 absolute left-[-8%] top-[8%] h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-hoop-200/60 absolute right-[-10%] top-[18%] h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-court-200/50 absolute bottom-[10%] left-[30%] h-60 w-60 rounded-full blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 py-8 sm:px-6">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="bg-play-600 shadow-play-200/70 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5-10-10" />
              </svg>
            </span>
            <span className="font-display text-ink-950 text-2xl font-bold tracking-tight">
              sportshub
            </span>
          </Link>
          <p className="text-ink-500 mx-auto mt-3 max-w-xl text-sm sm:text-base">
            The complete platform for youth basketball clubs, leagues, and families.
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}
