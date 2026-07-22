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
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
      <p className="text-ink-800 text-[13px] font-medium leading-relaxed">
        <b className="text-ink-950">This demo works on your phone.</b> For the best
        experience, view it on a computer.
      </p>
    </div>
  )
}
