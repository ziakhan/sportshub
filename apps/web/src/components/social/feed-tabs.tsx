import Link from "next/link"
import { cn } from "@/components/ui/cn"

/** Feed | My posts switcher — shared by /feed and /feed/mine */
export function FeedTabs({ active }: { active: "feed" | "mine" }) {
  return (
    <div className="bg-ink-100 flex w-fit rounded-xl p-1">
      {(
        [
          ["feed", "My Feed", "/feed"],
          ["mine", "My posts", "/feed/mine"],
        ] as const
      ).map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold",
            active === key ? "text-ink-950 bg-white shadow-sm" : "text-ink-500 hover:text-ink-800"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
