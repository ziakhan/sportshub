import Link from "next/link"
import Image from "next/image"

/**
 * Split-screen auth shell (2026-08-13). Was a 448px card centred on a pale
 * mesh background — on a 1440px monitor that left ~70% of the screen doing
 * nothing and made signing up feel like filing a form. Now a full-height
 * brand panel carries the pitch and a real product shot while the form sits
 * on its own calm surface. Shared by all five auth routes (sign-in, sign-up,
 * forgot-password, reset-password, magic-link), so this lifts every one.
 */

const PROOF = [
  "Live scores, box scores and recaps",
  "One calendar for every kid and team",
  "Registration, waivers and payments in one place",
]

function Wordmark({ reverse = false }: { reverse?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${
          reverse ? "bg-amber-500 text-amber-950" : "bg-play-600 shadow-play-200/70"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5-10-10" />
        </svg>
      </span>
      <span
        className={`font-display text-2xl font-bold tracking-tight ${
          reverse ? "text-white" : "text-ink-950"
        }`}
      >
        sportshub
      </span>
    </Link>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* ── Brand panel: desktop only, carries the pitch ───────────────── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0d1526] via-[#17253f] to-[#0a111d] p-10 text-white lg:flex lg:flex-col xl:p-14">
        {/* arena glow */}
        <div className="pointer-events-none absolute -right-24 -top-32 h-[30rem] w-[30rem] rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-play-500/20 blur-3xl" />

        <div className="relative z-10">
          <Wordmark reverse />
        </div>

        <div className="relative z-10 mt-auto max-w-[27rem]">
          <h2 className="font-display text-[2.75rem] font-black leading-[1.04] xl:text-[3.25rem]">
            Every game, every kid,
            <br />
            <span className="text-amber-400">one place.</span>
          </h2>
          <ul className="mt-8 space-y-3.5">
            {PROOF.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-6 text-white/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Real product, angled off the bottom edge — proof beats decoration */}
        <div className="pointer-events-none absolute -bottom-16 -right-10 z-0 hidden xl:block">
          <Image
            src="/shots/phone-home.png"
            alt=""
            width={780}
            height={1688}
            priority={false}
            className="h-[26rem] w-auto rotate-[7deg] rounded-[2rem] shadow-2xl ring-1 ring-white/10"
          />
        </div>

        <p className="relative z-10 mt-10 text-[13px] text-white/45">
          The complete platform for youth basketball clubs, leagues, and families.
        </p>
      </aside>

      {/* ── Form side ──────────────────────────────────────────────────── */}
      <main className="bg-ink-50/60 relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="bg-play-200/40 pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full blur-3xl lg:hidden" />
        <div className="bg-hoop-200/40 pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full blur-3xl lg:hidden" />

        {/* Mobile keeps the mark — the brand panel is desktop-only */}
        <div className="relative z-10 mb-8 text-center lg:hidden">
          <Wordmark />
          <p className="text-ink-500 mx-auto mt-3 max-w-sm text-sm">
            The complete platform for youth basketball clubs, leagues, and families.
          </p>
        </div>

        <div className="relative z-10 w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
