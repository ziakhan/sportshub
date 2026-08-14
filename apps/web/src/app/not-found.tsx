import Link from "next/link"
import { CourtBackdrop } from "@/components/ui/court-backdrop"

export default function NotFound() {
  return (
    <CourtBackdrop variant="ink" fullPage contentClassName="flex justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[28px] border border-white/12 bg-white/[0.06] p-8 text-center shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm">
        <p className="font-condensed text-[13px] font-black uppercase tracking-[0.28em] text-white/45">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">We cannot find that page</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          The link may be old, or the page moved. Everything else is still where you left it.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="bg-play-600 hover:bg-play-500 rounded-xl px-5 py-3 text-center text-sm font-semibold text-white transition"
          >
            Go to the home page
          </Link>
          <Link
            href="/scores"
            className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            See the scores
          </Link>
        </div>
      </div>
    </CourtBackdrop>
  )
}
