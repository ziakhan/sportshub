import { Badge } from "@/components/ui"
import { cn } from "@/components/ui/cn"

/**
 * The one visual marker for demo-world entities (limited-launch design).
 * Renders everywhere a demo league/club/game surfaces so a visitor can
 * never mistake preview data for a real season. Copy is deliberately
 * "Preview", not "Demo data", on compact surfaces; long form for pages.
 */
export function DemoBadge({
  long = false,
  className,
}: {
  long?: boolean
  className?: string
}) {
  return (
    <Badge
      tone="neutral"
      className={cn(
        "bg-amber-50 text-amber-800 ring-amber-300",
        className
      )}
    >
      {long ? "Preview · demo data" : "Preview"}
    </Badge>
  )
}
