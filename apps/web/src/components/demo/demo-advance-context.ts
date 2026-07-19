"use client"

import { createContext, useContext } from "react"

/**
 * Lets a scene's action button advance the walkthrough: the click IS the
 * transition, like using the real app. Null outside a player.
 */
export const DemoAdvanceContext = createContext<(() => void) | null>(null)

export function useDemoAdvance() {
  return useContext(DemoAdvanceContext)
}
