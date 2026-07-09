import type { ReactNode, MouseEventHandler } from "react"
import Link from "next/link"
import { cn } from "./cn"

export type ButtonVariant = "primary" | "secondary" | "subtle"
export type ButtonTone = "brand" | "court" | "hoop" | "play" | "ink"
export type ButtonSize = "sm" | "md" | "lg"

/** Solid fills (variant="primary"). */
const PRIMARY: Record<ButtonTone, string> = {
  brand: "text-[color:var(--brand-on)] hover:brightness-95 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.5)]",
  court: "bg-court-600 text-white hover:bg-court-700 shadow-[0_10px_24px_-14px_rgba(22,163,74,0.6)]",
  hoop: "bg-hoop-600 text-white hover:bg-hoop-700 shadow-[0_10px_24px_-14px_rgba(226,54,18,0.55)]",
  play: "bg-play-600 text-white hover:bg-play-700 shadow-[0_10px_24px_-14px_rgba(79,70,229,0.55)]",
  ink: "bg-ink-900 text-white hover:bg-ink-950 shadow-[0_10px_24px_-14px_rgba(24,24,27,0.55)]",
}

/** Soft tinted fills (variant="secondary"). */
const SECONDARY: Record<ButtonTone, string> = {
  brand: "bg-[var(--brand-soft)] text-[color:var(--brand-ink)] hover:brightness-95",
  court: "bg-court-50 text-court-700 hover:bg-court-100",
  hoop: "bg-hoop-50 text-hoop-700 hover:bg-hoop-100",
  play: "bg-play-50 text-play-700 hover:bg-play-100",
  ink: "bg-ink-100 text-ink-700 hover:bg-ink-200",
}

/** Outlined / ghost (variant="subtle") — tone-independent. */
const SUBTLE = "border-ink-200 text-ink-700 border bg-white hover:border-ink-300 hover:bg-ink-50"

const SIZES: Record<ButtonSize, string> = {
  sm: "gap-1.5 rounded-lg px-3 py-1.5 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5",
  md: "gap-2 rounded-xl px-4 py-2.5 text-sm [&>svg]:h-4 [&>svg]:w-4",
  lg: "gap-2 rounded-xl px-5 py-3 text-base [&>svg]:h-5 [&>svg]:w-5",
}

interface CommonProps {
  children: ReactNode
  variant?: ButtonVariant
  tone?: ButtonTone
  size?: ButtonSize
  /** Leading SVG icon node (unsized — the button sizes it per `size`). */
  icon?: ReactNode
  /** Full-width block button. */
  block?: boolean
  className?: string
}

interface LinkButtonProps extends CommonProps {
  href: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  disabled?: never
  type?: never
}

interface NativeButtonProps extends CommonProps {
  href?: undefined
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  type?: "button" | "submit" | "reset"
}

type ButtonProps = LinkButtonProps | NativeButtonProps

/**
 * The design-system action button — renders a `<Link>` when `href` is set,
 * else a native `<button>`. Press-scale, hover, and brand-aware focus ring.
 * `primary` + `brand` tone fills with the current brand color (`--brand`).
 */
export function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    tone = "brand",
    size = "md",
    icon,
    block,
    className,
  } = props

  const toneCls =
    variant === "subtle" ? SUBTLE : variant === "secondary" ? SECONDARY[tone] : PRIMARY[tone]

  const cls = cn(
    "brand-focus inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.97]",
    SIZES[size],
    toneCls,
    block && "w-full",
    className
  )

  // Primary+brand takes the brand fill via inline style (the value is dynamic).
  const style =
    variant === "primary" && tone === "brand" ? { backgroundColor: "var(--brand)" } : undefined

  if (props.href !== undefined) {
    return (
      <Link href={props.href} onClick={props.onClick} className={cls} style={style}>
        {icon}
        {children}
      </Link>
    )
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(cls, props.disabled && "pointer-events-none opacity-50")}
      style={style}
    >
      {icon}
      {children}
    </button>
  )
}
