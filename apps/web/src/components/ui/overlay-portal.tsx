"use client"

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"

/**
 * Escape hatch for dropdown panels (owner 2026-08-17: "dropdowns show above
 * everything else").
 *
 * An absolutely-positioned list inside a `relative` wrapper loses two ways no
 * z-index can win: a LATER sibling that forms its own stacking context paints
 * over it, and any `overflow-hidden` ancestor clips it. Both keep happening on
 * real forms (venue pickers, club search), so panels now render into
 * document.body through this portal: nothing on the page can sit above or
 * clip them.
 *
 * The wrapper is position:fixed, measured off the anchor and re-measured on
 * scroll (capture, so scrolling panels count), resize and anchor resize.
 *
 * Two contracts for consumers:
 *  1. The panel keeps its own styling but drops `absolute`/`top-full`/`mt-*`
 *     positioning: placement belongs to the portal.
 *  2. Outside-click handlers must ignore clicks inside the portal:
 *     `if ((e.target as Element).closest?.("[data-overlay-portal]")) return`
 */
export function OverlayPortal({
  anchorRef,
  open,
  children,
  matchWidth = true,
  align = "below",
  gap = 8,
}: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  children: ReactNode
  /** Panel width follows the anchor's width. Off for fixed-size popovers. */
  matchWidth?: boolean
  align?: "below" | "above"
  gap?: number
}) {
  const [box, setBox] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setBox(null)
      return
    }
    const el = anchorRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setBox(
        align === "below"
          ? { top: r.bottom + gap, left: r.left, width: r.width }
          : { bottom: window.innerHeight - r.top + gap, left: r.left, width: r.width }
      )
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      ro.disconnect()
    }
  }, [open, anchorRef, align, gap])

  if (!open || !box) return null

  return createPortal(
    <div
      data-overlay-portal=""
      style={{
        position: "fixed",
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        width: matchWidth ? box.width : undefined,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body
  )
}
