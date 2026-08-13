import { BrandIcon, BrandWordmark } from "@/components/brand/wordmark"

/**
 * Split-screen auth shell (2026-08-13). Was a 448px card centred on a pale
 * mesh — on a 1440px monitor ~70% of the screen did nothing. Shared by all
 * five auth routes (sign-in, sign-up, forgot-password, reset-password,
 * magic-link), so this lifts every one at once.
 *
 * PALETTE NOTE: an earlier pass accented this panel in AMBER, which is the
 * demo chrome's colour, not the product's. The brand lockup is navy stage +
 * play blue + a hoop-500 energy box (components/brand/wordmark.tsx), so the
 * panel now uses the BrandIcon's own navy gradient with hoop as the accent.
 * Auth should look like SportsHub, not like the demo.
 */

const PROOF = [
  "Live scores, box scores and recaps",
  "One calendar for every kid and team",
  "Registration, waivers and payments in one place",
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* ── Brand panel: desktop only ──────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#1e2d4d] via-[#16233d] to-[#0b1628] p-10 text-white lg:flex lg:flex-col xl:p-14">
        {/* Energy glow in the brand's own accent, not the demo's amber */}
        <div className="bg-hoop-500/25 pointer-events-none absolute -right-28 -top-28 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="bg-play-500/25 pointer-events-none absolute -left-24 bottom-[-6rem] h-96 w-96 rounded-full blur-3xl" />

        {/* Court geometry, large and quiet — texture, not a diagram */}
        <svg
          className="pointer-events-none absolute -bottom-24 -right-16 h-[34rem] w-[34rem] opacity-[0.07]"
          viewBox="0 0 200 200"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="100" cy="100" r="52" />
          <path d="M4 48h192M4 152h192" />
          <path d="M100 4v192" />
        </svg>

        <div className="relative z-10 flex items-center gap-3">
          <BrandIcon size={40} />
          <BrandWordmark size="md" variant="reverse" />
        </div>

        {/* Centred, not bottom-pinned — the old version left a hole in the middle */}
        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <h2 className="font-display max-w-[26rem] text-[2.75rem] font-black leading-[1.04] xl:text-[3.15rem]">
            Every game, every kid,
            <br />
            <span className="text-hoop-400">one place.</span>
          </h2>
          <ul className="mt-9 space-y-4">
            {PROOF.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-6 text-white/80">
                <span className="bg-hoop-500/20 text-hoop-400 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
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

        <p className="relative z-10 text-[13px] text-white/40">
          The complete platform for youth basketball clubs, leagues, and families.
        </p>
      </aside>

      {/* ── Form side ──────────────────────────────────────────────────── */}
      <main className="bg-ink-50/70 relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="bg-play-200/40 pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full blur-3xl lg:hidden" />
        <div className="bg-hoop-200/40 pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full blur-3xl lg:hidden" />

        {/* Mobile keeps the lockup — the brand panel is desktop-only */}
        <div className="relative z-10 mb-8 flex flex-col items-center text-center lg:hidden">
          <div className="flex items-center gap-2.5">
            <BrandIcon size={36} />
            <BrandWordmark size="md" />
          </div>
          <p className="text-ink-500 mx-auto mt-3 max-w-sm text-sm">
            The complete platform for youth basketball clubs, leagues, and families.
          </p>
        </div>

        <div className="relative z-10 w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
