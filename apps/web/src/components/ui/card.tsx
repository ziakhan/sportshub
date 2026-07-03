import type { ReactNode } from "react"
import { cn } from "./cn"

interface CardProps {
  children: ReactNode
  className?: string
  /** Adds the hover-lift interaction (use for clickable cards). */
  lift?: boolean
  /** Tighter radius/padding scale for dense contexts. */
  size?: "default" | "sm"
}

/**
 * The canonical surface of the design system — replaces the repeated
 * `rounded-[28px] border border-ink-100 bg-white shadow-soft` idiom that was
 * inlined across dozens of pages.
 */
export function Card({ children, className, lift = false, size = "default" }: CardProps) {
  return (
    <div
      className={cn(
        "border-ink-100 shadow-soft border bg-white",
        size === "sm" ? "rounded-2xl p-5" : "rounded-[28px] p-6",
        lift && "card-lift",
        className
      )}
    >
      {children}
    </div>
  )
}
