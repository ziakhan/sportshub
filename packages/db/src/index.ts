import { PrismaClient } from "@prisma/client"

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

// Tenant-scoped models (auto-inject tenant_id)
const TENANT_SCOPED_MODELS = [
  "Team",
  "Tryout",
  "Practice",
  "Venue",
  "Announcement",
] as const

// Helper to get tenant context
// This will be enhanced with AsyncLocalStorage in Sprint 1
let currentTenantId: string | null = null

export function setTenantContext(tenantId: string | null) {
  currentTenantId = tenantId
}

export function getTenantContext(): string | null {
  return currentTenantId
}

// Tenant-aware Prisma middleware (to be implemented in Sprint 1)
// This will automatically inject tenantId into queries
export async function runWithTenant<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  const previousTenantId = currentTenantId
  currentTenantId = tenantId
  try {
    return await fn()
  } finally {
    currentTenantId = previousTenantId
  }
}

// Export types
export * from "@prisma/client"
