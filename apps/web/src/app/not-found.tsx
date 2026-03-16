import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-4xl font-bold">404</h2>
        <p className="mb-4 text-gray-600">Page not found</p>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
