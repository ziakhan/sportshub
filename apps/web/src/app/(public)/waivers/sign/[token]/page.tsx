import { getSignRequestByToken } from "@/lib/waivers/tokens"
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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-4xl">⏳</p>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            This signing link is no longer valid
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            The link may have expired, already been used, or been replaced by a newer
            one. Check your inbox for a more recent email, or ask the organization to
            send a fresh link.
          </p>
        </div>
      </div>
    )
  }

  if (lookup.alreadySigned) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-4xl">✅</p>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Already signed</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {lookup.waiver.title} has already been signed for{" "}
            <span className="font-semibold">
              {lookup.player.firstName} {lookup.player.lastName}
            </span>
            . Nothing more is needed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-indigo-600">
            {lookup.waiver.orgName}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{lookup.waiver.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            For{" "}
            <span className="font-semibold text-gray-700">
              {lookup.player.firstName} {lookup.player.lastName}
            </span>
            {lookup.waiver.annualRenewal ? " · renews yearly" : null}
          </p>
        </div>
        <div className="max-h-[45vh] overflow-y-auto border-b border-gray-100 bg-gray-50 p-6 sm:p-8">
          <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-gray-700">
            {lookup.waiver.body}
          </pre>
        </div>
        <SignForm
          token={params.token}
          playerName={`${lookup.player.firstName} ${lookup.player.lastName}`}
          orgName={lookup.waiver.orgName}
        />
      </div>
    </div>
  )
}
