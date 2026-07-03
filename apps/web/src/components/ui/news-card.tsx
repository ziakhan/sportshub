import Link from "next/link"
import { cn } from "./cn"

interface NewsCardProps {
  title: string
  excerpt?: string
  coverUrl?: string | null
  dateLabel: string
  author?: string
  href?: string
  className?: string
}

/** A news/announcement post card for the News tabs on hub pages and home. */
export function NewsCard({ title, excerpt, coverUrl, dateLabel, author, href, className }: NewsCardProps) {
  const inner = (
    <article
      className={cn(
        "card-lift border-ink-100 shadow-soft group flex h-full flex-col overflow-hidden rounded-[24px] border bg-white",
        className
      )}
    >
      {coverUrl ? (
        <div className="bg-ink-100 aspect-[16/9] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="from-play-100 to-hoop-100 aspect-[16/9] w-full bg-gradient-to-br" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="text-ink-400 mb-2 flex items-center gap-2 text-xs font-medium">
          <span>{dateLabel}</span>
          {author && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>{author}</span>
            </>
          )}
        </div>
        <h3 className="text-ink-950 group-hover:text-play-600 text-lg font-bold transition-colors">
          {title}
        </h3>
        {excerpt && <p className="text-ink-500 mt-2 line-clamp-2 flex-1 text-sm leading-6">{excerpt}</p>}
      </div>
    </article>
  )

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  )
}
