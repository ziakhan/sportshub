"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold">Something went wrong</h2>
        <p className="mb-4 text-gray-600">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
