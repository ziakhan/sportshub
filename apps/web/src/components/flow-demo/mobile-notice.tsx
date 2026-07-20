/**
 * Phone-only heads-up above the live demos: the demo is fully functional on
 * a phone, but the big operator screens make it shine on a computer. Framed
 * as guidance, not an apology, so a phone viewer doesn't read the small
 * screens as the product being bad.
 */
export function MobileDesktopNotice() {
  return (
    <div className="border-gold-300 bg-gold-50 mb-5 flex items-start gap-3 rounded-2xl border-2 p-4 sm:hidden">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gold-600 mt-0.5 h-5 w-5 shrink-0"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <p className="text-ink-800 text-[13px] font-medium leading-relaxed">
        <b className="text-ink-950">You&apos;re on a phone: this demo works here, but it&apos;s best
        on a computer.</b>{" "}
        It walks through big desktop screens, so the camera zooms and pans to keep up. On a
        laptop you see everything at full size. Either way, everything you watch is the real
        product.
      </p>
    </div>
  )
}
