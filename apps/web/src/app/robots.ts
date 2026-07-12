import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"
import { isSeoIndexingEnabled } from "@/lib/platform-settings"

export const dynamic = "force-dynamic"

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Owner-controlled kill-switch (admin → settings): until it's flipped at
  // go-live, tell crawlers to stay out entirely.
  if (!(await isSeoIndexingEnabled())) {
    return { rules: [{ userAgent: "*", disallow: "/" }] }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/onboarding",
          "/admin",
          "/manage",
          "/clubs/", // platform-side club admin (public pages live at /club/)
          "/sign-in",
          "/sign-up",
          "/forgot-password",
          "/reset-password",
          "/invitations/",
          "/player-invitations/",
          "/unsubscribed",
          "/style-guide",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
