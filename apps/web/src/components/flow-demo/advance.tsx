"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { cn } from "@/components/ui/cn"

interface AdvanceApi {
  /** Move to the next scene, optionally showing a confirmation first. */
  advance: (confirm?: string) => void
  /** The current Advance control registers itself so autoplay can press it. */
  register: (trigger: () => void) => () => void
}

export const AdvanceContext = createContext<AdvanceApi | null>(null)

/**
 * Wraps the one control on a scene that moves the demo forward. Draws the
 * glowing highlight ring around its child (usually a real kit Button, a card,
 * or a row) and captures the click. `confirm` shows a green-tick confirmation
 * (e.g. "Offer sent") before the next scene appears.
 */
export function Advance({
  confirm,
  children,
  className,
  block,
}: {
  confirm?: string
  children: ReactNode
  className?: string
  block?: boolean
}) {
  const api = useContext(AdvanceContext)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!api) return
    return api.register(() => {
      const el = ref.current
      if (el) {
        el.classList.add("demo-advance-pressed")
        setTimeout(() => el.classList.remove("demo-advance-pressed"), 220)
      }
      api.advance(confirm)
    })
  }, [api, confirm])

  return (
    <span
      ref={ref}
      data-demo-advance
      onClickCapture={(e) => {
        e.preventDefault()
        e.stopPropagation()
        api?.advance(confirm)
      }}
      className={cn(
        "demo-advance relative cursor-pointer",
        block ? "block" : "inline-block",
        className
      )}
    >
      {children}
    </span>
  )
}
