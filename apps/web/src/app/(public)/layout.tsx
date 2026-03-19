import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Youth Basketball Hub
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/marketplace"
              className="hidden text-gray-600 hover:text-gray-900 sm:block"
            >
              Tryouts
            </Link>
            <Link
              href="/club"
              className="hidden text-gray-600 hover:text-gray-900 sm:block"
            >
              Clubs
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-md px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t bg-white py-8 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Youth Basketball Hub. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
