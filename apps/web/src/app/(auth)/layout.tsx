import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-950">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-bold text-orange-400">
            Youth Basketball Hub
          </Link>
          <p className="mt-2 text-gray-400">
            The complete platform for youth basketball clubs, leagues, and families
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
