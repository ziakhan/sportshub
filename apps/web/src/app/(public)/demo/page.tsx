import { DemoPlayer, type DemoChapter, type DemoScene } from "@/components/demo/demo-player"
import {
  F_TRYOUT_CREATE,
  F_TRYOUT_PUBLISH,
  F_PARENT_FIND,
  F_PARENT_DETAILS,
  F_PARENT_REGISTER,
  F_PARENT_PAY,
  F_CLUB_SIGNUPS,
  F_OFFER_TEMPLATE,
  F_OFFER_SEND_DUO,
  F_OFFER_PACKAGE,
  F_OFFER_SIZES,
  F_OFFER_CONFIRMED,
  F_OFFER_BOARD,
  F_ROSTER_SUBMIT,
  F_PREGAME,
  F_LIVE_DUO,
  F_PARENT_LIVE,
  F_FINAL_BOX,
  F_RECAP_STANDINGS,
} from "@/components/demo/flow-scenes"

export const metadata = {
  title: "See It Work | SportsHub One",
  alternates: { canonical: "/demo" },
  description:
    "Walk one season end to end: the club posts a tryout, a family registers and pays, offers go out and come back accepted, and game night runs live.",
}

const FLOW: DemoScene[] = [
  F_TRYOUT_CREATE,
  F_TRYOUT_PUBLISH,
  F_PARENT_FIND,
  F_PARENT_DETAILS,
  F_PARENT_REGISTER,
  F_PARENT_PAY,
  F_CLUB_SIGNUPS,
  F_OFFER_TEMPLATE,
  F_OFFER_SEND_DUO,
  F_OFFER_PACKAGE,
  F_OFFER_SIZES,
  F_OFFER_CONFIRMED,
  F_OFFER_BOARD,
  F_ROSTER_SUBMIT,
  F_PREGAME,
  F_LIVE_DUO,
  F_PARENT_LIVE,
  F_FINAL_BOX,
  F_RECAP_STANDINGS,
]

const CHAPTERS: DemoChapter[] = [
  { title: "Tryouts", start: 0 },
  { title: "Offers", start: 7 },
  { title: "Game night", start: 14 },
]

export default function DemoPage() {
  return (
    <>
      <section className="mesh-surface border-ink-100 border-b bg-[#fafafa] py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center sm:px-6">
          <h1 className="font-display text-ink-950 mb-4 text-balance text-3xl font-extrabold leading-tight sm:text-5xl">
            One season,{" "}
            <span className="from-play-600 to-hoop-500 bg-gradient-to-r bg-clip-text text-transparent">
              step by step
            </span>
          </h1>
          <p className="text-ink-500 mx-auto max-w-2xl text-base leading-7 sm:text-lg">
            The club works on a computer. The family lives on a phone. Follow one season through
            both, in order, at your own pace.
          </p>
        </div>
      </section>

      <section className="bg-white py-8 sm:py-12">
        <div className="container mx-auto px-2 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <DemoPlayer title="One season, step by step" scenes={FLOW} chapters={CHAPTERS} wide />
          </div>
        </div>
      </section>
    </>
  )
}
