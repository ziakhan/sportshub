import { siteUrl, SITE_NAME } from "@/lib/site"

/**
 * Renders a schema.org JSON-LD block. `<` is escaped so user-supplied strings
 * (club descriptions, review text) can't close the script tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path}`
}

/** Site-wide Organization + WebSite graph (root layout). */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl()}/#org`,
        name: SITE_NAME,
        url: siteUrl(),
        logo: absoluteUrl("/icon.svg"),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl()}/#website`,
        name: SITE_NAME,
        url: siteUrl(),
        publisher: { "@id": `${siteUrl()}/#org` },
      },
    ],
  }
}

/** Club page: SportsOrganization (+LocalBusiness fields) with star ratings. */
export function clubJsonLd(input: {
  slug: string
  name: string
  description?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  phoneNumber?: string | null
  website?: string | null
  logoUrl?: string | null
  averageRating: number | null
  totalReviews: number
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["SportsOrganization", "LocalBusiness"],
    "@id": absoluteUrl(`/club/${input.slug}#org`),
    name: input.name,
    sport: "Basketball",
    url: absoluteUrl(`/club/${input.slug}`),
  }
  if (input.description) data.description = input.description
  if (input.logoUrl) data.logo = input.logoUrl
  if (input.website) data.sameAs = [input.website]
  if (input.phoneNumber) data.telephone = input.phoneNumber
  if (input.city || input.address) {
    data.address = {
      "@type": "PostalAddress",
      ...(input.address ? { streetAddress: input.address } : {}),
      ...(input.city ? { addressLocality: input.city } : {}),
      ...(input.state ? { addressRegion: input.state } : {}),
      ...(input.country ? { addressCountry: input.country } : {}),
    }
  }
  if (input.averageRating !== null && input.totalReviews > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.averageRating,
      reviewCount: input.totalReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }
  return data
}

/** Program pages (camp / tryout / house league / tournament): SportsEvent. */
export function programEventJsonLd(input: {
  path: string
  name: string
  description?: string | null
  startDate: Date
  endDate?: Date | null
  locationName: string
  city?: string | null
  state?: string | null
  fee: number
  currency: string
  organizerName?: string | null
  organizerSlug?: string | null
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: input.name,
    sport: "Basketball",
    url: absoluteUrl(input.path),
    startDate: input.startDate.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: input.locationName,
      ...(input.city
        ? {
            address: {
              "@type": "PostalAddress",
              addressLocality: input.city,
              ...(input.state ? { addressRegion: input.state } : {}),
            },
          }
        : {}),
    },
    offers: {
      "@type": "Offer",
      price: input.fee,
      priceCurrency: input.currency,
      url: absoluteUrl(input.path),
      availability: "https://schema.org/InStock",
    },
  }
  if (input.endDate) data.endDate = input.endDate.toISOString()
  if (input.description) data.description = input.description
  if (input.organizerName) {
    data.organizer = input.organizerSlug
      ? { "@id": absoluteUrl(`/club/${input.organizerSlug}#org`), "@type": "SportsOrganization", name: input.organizerName }
      : { "@type": "SportsOrganization", name: input.organizerName }
  }
  return data
}

/** Recap/news story: NewsArticle. */
export function newsArticleJsonLd(input: {
  slug: string
  title: string
  body: string
  publishedAt?: Date | null
  imageUrls?: string[]
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: input.title,
    description: input.body.replace(/\s+/g, " ").slice(0, 155),
    mainEntityOfPage: absoluteUrl(`/news/${input.slug}`),
    author: { "@id": `${siteUrl()}/#org` },
    publisher: { "@id": `${siteUrl()}/#org` },
  }
  if (input.publishedAt) data.datePublished = input.publishedAt.toISOString()
  if (input.imageUrls?.length) data.image = input.imageUrls
  return data
}
