"use client"

import { createContext, useContext, ReactNode } from "react"
import { createContextualCan } from "@casl/react"
import { AppAbility } from "./permissions"

// Tenant Context
interface TenantContextType {
  tenant: {
    id: string
    slug: string
    name: string
    timezone?: string
  } | null
}

const TenantContext = createContext<TenantContextType>({ tenant: null })

export function TenantProvider({
  children,
  tenant,
}: {
  children: ReactNode
  tenant: TenantContextType["tenant"]
}) {
  return <TenantContext.Provider value={{ tenant }}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within TenantProvider")
  }
  return context
}

// Ability Context (CASL)
const AbilityContext = createContext<AppAbility | undefined>(undefined)

export function AbilityProvider({
  children,
  ability,
}: {
  children: ReactNode
  ability: AppAbility
}) {
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
}

export function useAbility() {
  const context = useContext(AbilityContext)
  if (context === undefined) {
    throw new Error("useAbility must be used within AbilityProvider")
  }
  return context
}

// Create contextual Can component
export const Can = createContextualCan(AbilityContext.Consumer as any)
