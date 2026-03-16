// Environment configuration
export const config = {
  app: {
    name: "Youth Basketball Hub",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    platformDomain: process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "app.youthbasketballhub.com",
  },
  clerk: {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
    secretKey: process.env.CLERK_SECRET_KEY!,
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    platformFeePercent: 5, // 5% platform fee
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
} as const

// Feature flags
export const features = {
  enableTournaments: false, // v1+
  enableChat: false, // v1+
  enableReviews: true, // MVP
  enableRefereeMarketplace: false, // v1+
} as const

// Constants
export const constants = {
  ageGroups: ["U8", "U10", "U12", "U14", "U16", "U18"] as const,
  genders: ["MALE", "FEMALE", "COED"] as const,
  tenantPlans: ["FREE", "BASIC", "PRO", "ENTERPRISE"] as const,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  defaultTimezone: "America/New_York",
  minPlayerAge: 5,
  maxPlayerAge: 18,
  copaMinorAge: 13,
} as const

// Rate limits
export const rateLimits = {
  authenticated: 100, // requests per minute
  unauthenticated: 20, // requests per minute
  payment: 10, // requests per minute for payment operations
} as const

export type AgeGroup = typeof constants.ageGroups[number]
export type Gender = typeof constants.genders[number]
export type TenantPlan = typeof constants.tenantPlans[number]
