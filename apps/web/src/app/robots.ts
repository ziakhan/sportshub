import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
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
