import { getSignRequestByToken } from "@/lib/waivers/tokens"
import { CourtBackdrop } from "@/components/ui"
import { SignForm } from "./sign-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Sign waiver",
  robots: { index: false, follow: false },
}

/**
 * Public tokenized waiver signing (waivers-esign, owner spec 2026-07-20).
 * The emailed token is the auth — parents sign without an account. Invalid,
 * expired, and already-signed states render inline; the actual signing UI is
 * the client SignForm (SignaturePad reuse).
 */
export default async function WaiverSignPage({ params }: { params: { token: string } }) {
  const lookup = await getSignRequestByToken(params.token)

  if (!lookup) {
    return (
      <CourtBackdrop
        variant="daylight"
        className="flex min-h-[calc(100vh-4rem)] items-center"
        contentClassName="mx-auto max-w-lg px-4 py-16 text-center"
      >
        <div className="border-ink-100 shadow-panel rounded-[28px] border bg-white p-8">
          <div className="bg-hoop-50 text-hoop-600 mx-auto grid h-14 w-14 place-items-center rounded-2xl">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-ink-950 mt-4 text-xl font-bold">
            This signing link is no longer valid
          </h1>
          <p className="text-ink-600 mt-3 text-sm leading-relaxed">
            The link may have expired, already been used, or been replaced by a newer
            one. Check your inbox for a more recent email, or ask the organization to
            send a fresh link.
          </p>
        </div>
      </CourtBackdrop>
    )
  }

  if (lookup.alreadySigned) {
    return (
      <CourtBackdrop
        variant="daylight"
        className="flex min-h-[calc(100vh-4rem)] items-center"
        contentClassName="mx-auto max-w-lg px-4 py-16 text-center"
      >
        <div className="border-ink-100 shadow-panel rounded-[28px] border bg-white p-8">
          <div className="bg-court-50 text-court-600 mx-auto grid h-14 w-14 place-items-center rounded-2xl">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-ink-950 mt-4 text-xl font-bold">Already signed</h1>
          <p className="text-ink-600 mt-3 text-sm leading-relaxed">
            {lookup.waiver.title} has already been signed for{" "}
            <span className="font-semibold">
              {lookup.player.firstName} {lookup.player.lastName}
            </span>
            . Nothing more is needed.
          </p>
        </div>
      </CourtBackdrop>
    )
  }

  return (
    <CourtBackdrop
      variant="daylight"
      className="flex min-h-[calc(100vh-4rem)] items-center"
      contentClassName="mx-auto max-w-2xl px-4 py-8 sm:py-12"
    >
      <div className="border-ink-100 shadow-panel overflow-hidden rounded-[28px] border bg-white">
        <div className="border-ink-100 border-b p-6 sm:p-8">
          <p className="text-play-600 text-[11px] font-bold uppercase tracking-[2px]">
            {lookup.waiver.orgName}
          </p>
          <h1 className="text-ink-950 mt-2 text-2xl font-bold">{lookup.waiver.title}</h1>
          <p className="text-ink-500 mt-1 text-sm">
            For{" "}
            <span className="text-ink-700 font-semibold">
              {lookup.player.firstName} {lookup.player.lastName}
            </span>
            {lookup.waiver.annualRenewal ? " · renews yearly" : null}
          </p>
        </div>
        <div className="border-ink-100 bg-ink-50 max-h-[45vh] overflow-y-auto border-b p-6 sm:p-8">
          <pre className="text-ink-700 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed">
            {lookup.waiver.body}
          </pre>
        </div>
        <SignForm
          token={params.token}
          playerName={`${lookup.player.firstName} ${lookup.player.lastName}`}
          orgName={lookup.waiver.orgName}
        />
      </div>
    </CourtBackdrop>
  )
}
