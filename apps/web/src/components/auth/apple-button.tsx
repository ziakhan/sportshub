"use client"

/** Apple sign-in button per Apple's branding guidance (black, official ). */
export function AppleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-black/85"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M16.98 12.73c.03 3.13 2.75 4.17 2.78 4.18-.02.07-.43 1.48-1.43 2.94-.86 1.26-1.76 2.51-3.17 2.54-1.39.03-1.83-.82-3.42-.82-1.58 0-2.08.79-3.39.85-1.36.05-2.4-1.36-3.27-2.62C3.3 17.23 1.94 12.53 3.76 9.4c.9-1.55 2.52-2.54 4.28-2.56 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.68.03 2.57.27 3.79 2.06-.1.06-2.26 1.32-2.23 3.88ZM14.37 5.1c.72-.87 1.21-2.09 1.08-3.3-1.04.04-2.3.69-3.05 1.57-.67.77-1.26 2.01-1.1 3.2 1.16.09 2.34-.59 3.07-1.47Z" />
      </svg>
      {label}
    </button>
  )
}
