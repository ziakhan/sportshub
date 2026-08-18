import {
  MockCalendarEvent,
  MockNotificationRow,
} from "@/components/demo-directory/mock-ui"

/**
 * Dev preview for the REAL-SCREEN mock standard (owner 2026-08-19): the
 * exemplar mocks rendered at phone width so they can be judged against the
 * real /calendar and /notifications screens side by side. Dev-only route.
 */
export default function MockKitPage() {
  return (
    <main className="min-h-screen bg-ink-100 px-4 py-8">
      <div className="mx-auto w-[390px] space-y-8">
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-500">
            Calendar entries (vs /calendar)
          </h2>
          <div className="space-y-2.5 rounded-2xl bg-white p-3">
            <MockCalendarEvent
              kind="game"
              time="6:00 – 7:30 PM"
              title="vs Burlington Force"
              detail="Grade 10 Girls"
              place="The Playground · Toronto Lords Grade 10 Girls"
              kidDot="bg-play-500"
              rsvp="going"
            />
            <MockCalendarEvent
              kind="practice"
              time="6:30 – 8:00 PM"
              title="Practice"
              place="Central Tech Gym · Toronto Lords Grade 9"
              kidDot="bg-gold-500"
              rsvp="maybe"
            />
            <MockCalendarEvent
              kind="event"
              time="2:00 – 6:00 PM"
              title="NPH Summer Media Day"
              place="The Playground · Toronto Lords Grade 10 Girls"
            />
            <MockCalendarEvent
              kind="game"
              time="9:00 – 10:30 AM"
              title="vs Mississauga Monarchs"
              detail="Grade 9 Boys"
              place="Haber Recreation Centre"
              live
            />
            <MockCalendarEvent
              kind="practice"
              time="6:00 – 7:30 PM"
              title="Practice"
              place="The Playground · Toronto Lords Grade 10 Girls"
              cancelled
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-500">
            Notifications (vs /notifications)
          </h2>
          <div className="space-y-2.5">
            <MockNotificationRow
              unread
              title="Game moved"
              message="Sat vs Burlington Force now tips at 2:00 PM at Haber Recreation Centre, Court 2."
              time="2 minutes ago"
            />
            <MockNotificationRow
              unread
              title="Payment received"
              message="Darius's fall registration is paid in full. Receipt in your email."
              time="1 hour ago"
            />
            <MockNotificationRow
              title="New game recap"
              message="Toronto Lords Grade 10 Girls beat Burlington Force 54-33. Danielle R. named Player of the Game."
              time="Yesterday"
            />
          </div>
        </section>
      </div>
    </main>
  )
}
