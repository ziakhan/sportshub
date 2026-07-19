import Image from "next/image"

/**
 * Real product screenshots on the marketing pages. Every image under
 * /public/shots is captured from the live demo world by
 * scripts/demo/capture-shots.mjs: desktop at 1440x900, phone at a true
 * iPhone viewport (390x844 @2x). Nothing is drawn or mocked. Re-run the
 * script whenever the UI changes.
 */

export function BrowserShot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="min-w-0">
      <a href={src} target="_blank" rel="noreferrer" title="Open full size" className="border-ink-200 block cursor-zoom-in overflow-hidden rounded-xl border bg-white shadow-xl">
        <div className="border-ink-100 flex items-center gap-1.5 border-b bg-[#eef0f6] px-3 py-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#fc5753]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#fdbc40]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#33c748]" />
        </div>
        <Image src={src} alt={alt} width={1440} height={900} className="h-auto w-full" />
      </a>
      <figcaption className="text-ink-500 mt-2 text-center text-[13px] font-medium">{caption} · tap to zoom</figcaption>
    </figure>
  )
}

export function PhoneShot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="mx-auto w-full max-w-[300px] min-w-0">
      <a href={src} target="_blank" rel="noreferrer" title="Open full size" className="block cursor-zoom-in rounded-[30px] border-[6px] border-[#101322] bg-[#101322] shadow-xl">
        <div className="overflow-hidden rounded-[24px]">
          <Image src={src} alt={alt} width={780} height={1688} className="h-auto w-full" />
        </div>
      </a>
      <figcaption className="text-ink-500 mt-2 text-center text-[13px] font-medium">{caption}</figcaption>
    </figure>
  )
}
