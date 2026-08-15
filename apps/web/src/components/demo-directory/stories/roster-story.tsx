"use client"

import { TypeText } from "../motion"
import {
  MockBand,
  MockButton,
  MockDialog,
  MockField,
  MockPanel,
  MockPill,
  MockRow,
  MockTile,
  MockTopBar,
  PhoneProgramCard,
  PhoneShell,
} from "../mock-ui"
import type { DemoScript } from "../types"

/**
 * Story 1, opening minute: "Build a team, fill the roster".
 *
 * This is the proof scene for the v2 kit. It stays inside one screen of the
 * club workspace on the desktop side, then brings the phone into its reserved
 * slot for the handoff. Nothing pans, nothing zooms, nothing scrolls: every
 * beat happens where the last one left the eye.
 */
export const rosterStory: DemoScript = {
  desktopUrl: "/manage/clubs/riverside-ravens",
  initialStage: "desktop",
  chapters: [
    { id: "post", title: "Post the tryout" },
    { id: "reach", title: "It reaches families" },
  ],
  beats: [
    {
      id: "open",
      chapter: "post",
      caption:
        "Riverside Ravens run six teams. Fall tryouts are not posted yet, so the season has not started.",
      hold: 2600,
    },
    {
      id: "hover-post",
      chapter: "post",
      caption: "The club manager starts where every season starts, with a tryout.",
      hold: 1500,
      cursor: "post-tryout",
    },
    {
      id: "press-post",
      chapter: "post",
      caption: "One button opens the form. Nothing to set up first.",
      hold: 1700,
      cursor: "post-tryout",
      press: true,
      set: { dialog: true },
    },
    {
      id: "type-title",
      chapter: "post",
      caption: "Name it.",
      hold: 2600,
      cursor: "field-title",
      type: { key: "title", text: "U14 Boys Fall Tryout" },
    },
    {
      id: "pick-when",
      chapter: "post",
      caption: "Pick the date and the gym that is already on file.",
      hold: 2300,
      cursor: "field-when",
      set: {
        when: "Saturday 12 September, 6:00 PM",
        gym: "Riverside Community Centre, Court 2",
      },
    },
    {
      id: "type-fee",
      chapter: "post",
      caption: "Set the tryout fee. It is collected when a family registers.",
      hold: 2100,
      cursor: "field-fee",
      type: { key: "fee", text: "25" },
    },
    {
      id: "publish",
      chapter: "post",
      caption: "Published to the club page and the marketplace in one press.",
      hold: 2600,
      cursor: "publish-tryout",
      press: true,
      toast: "Tryout published",
      set: { dialog: false, published: true, openPrograms: "1" },
    },
    {
      id: "phone-in",
      chapter: "reach",
      caption:
        "Every family following Riverside sees it on their phone. Nobody has to forward anything.",
      hold: 2400,
      stage: "split",
      set: { phone: true },
    },
    {
      id: "card-in",
      chapter: "reach",
      caption:
        "It arrives as a card in their programs list with the date, the gym and the fee.",
      hold: 2800,
      set: { phoneCard: true },
    },
    {
      id: "register",
      chapter: "reach",
      caption: "Registering is one tap, and the roster starts filling itself.",
      hold: 2800,
      cursor: "phone-register",
    },
  ],

  render: ({ get, typingKey }) => {
    const dialog = get("dialog", false)
    const published = get("published", false)
    const phoneCard = get("phoneCard", false)

    const desktop = (
      <div className="relative flex h-full flex-col">
        <MockTopBar
          workspace="Riverside Ravens"
          tabs={["Dashboard", "Teams", "Programs", "Payments", "People"]}
          activeTab="Programs"
        />
        <MockBand
          eyebrow="Club workspace"
          title="Programs"
          description="Tryouts, camps and house leagues families can find and pay for."
          action={
            <MockButton id="post-tryout" icon={<PlusIcon />}>
              Post a tryout
            </MockButton>
          }
        />
        <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-5">
          <div className="grid grid-cols-4 gap-3">
            <MockTile label="Teams" value="6" />
            <MockTile label="Registered players" value="74" />
            <MockTile
              label="Open programs"
              value={get("openPrograms", "0")}
              tone={published ? "court" : "neutral"}
            />
            <MockTile label="Waitlist" value="12" tone="hoop" />
          </div>

          <MockPanel
            title="This season"
            meta="Fall 2026"
            className="mt-4"
            action={<MockPill tone="neutral">4 programs</MockPill>}
          >
            {published && (
              <div className="live-row-in border-court-100 bg-court-50/50 flex items-center gap-3 border-b px-4 py-3">
                <span className="bg-court-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white">
                  <CheckIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900 truncate text-[13px] font-semibold">
                    U14 Boys Fall Tryout
                  </p>
                  <p className="text-ink-500 truncate text-[11px]">
                    Saturday 12 September, 6:00 PM at Riverside Community Centre
                  </p>
                </div>
                <MockPill tone="court">Published</MockPill>
              </div>
            )}
            <MockRow
              title="House League Fall registration"
              meta="Opens 1 September, 48 spots"
              right={<MockPill tone="gold">Draft</MockPill>}
            />
            <MockRow
              title="Spring Skills Camp"
              meta="Finished 22 June, 36 registered"
              right={<MockPill>Closed</MockPill>}
              muted
            />
            <MockRow
              title="U16 Girls Fall Tryout"
              meta="Saturday 12 September, 8:00 PM"
              right={<MockPill tone="gold">Draft</MockPill>}
            />
          </MockPanel>
        </div>

        <MockDialog
          open={Boolean(dialog)}
          title="Post a tryout"
          subtitle="Families see this on your club page and on the marketplace."
          footer={
            <>
              <MockButton tone="quiet" size="sm">
                Cancel
              </MockButton>
              <MockButton id="publish-tryout" size="sm">
                Publish tryout
              </MockButton>
            </>
          }
        >
          <div className="space-y-3">
            <MockField id="field-title" label="Tryout name">
              <TypeText
                text={get("title", "")}
                typing={typingKey === "title"}
                placeholder="Name this tryout"
              />
            </MockField>
            <div className="grid grid-cols-2 gap-3">
              <MockField id="field-when" label="Date and time">
                <span className={get("when", "") ? "text-ink-900" : "text-ink-400"}>
                  {get("when", "Choose a date")}
                </span>
              </MockField>
              <MockField id="field-gym" label="Gym">
                <span className={get("gym", "") ? "text-ink-900" : "text-ink-400"}>
                  {get("gym", "Choose a venue")}
                </span>
              </MockField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MockField id="field-fee" label="Tryout fee" hint="Collected at registration">
                <span className="text-ink-400 mr-0.5">$</span>
                <TypeText text={get("fee", "")} typing={typingKey === "fee"} placeholder="0" />
              </MockField>
              <MockField id="field-age" label="Age group">
                <span className="text-ink-900">U14 Boys</span>
              </MockField>
            </div>
          </div>
        </MockDialog>
      </div>
    )

    const phone = (
      <PhoneShell title="Riverside Ravens" subtitle="Following" activeTab="Home">
        <p className="text-ink-500 mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
          Programs near you
        </p>
        <div className="space-y-2.5">
          {phoneCard && (
            <PhoneProgramCard
              kind="Tryout"
              title="U14 Boys Fall Tryout"
              club="Riverside Ravens"
              meta="Saturday 12 September, 6:00 PM at Riverside Community Centre"
              fee="$25"
              action="Register"
              actionId="phone-register"
              fresh
            />
          )}
          <PhoneProgramCard
            kind="House league"
            title="House League Fall registration"
            club="Riverside Ravens"
            meta="Opens 1 September, ages 8 to 14"
            fee="$210"
          />
        </div>
      </PhoneShell>
    )

    return { desktop, phone }
  },
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}
