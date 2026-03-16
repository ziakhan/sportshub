export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Youth Basketball Hub</h1>
          <p className="mt-2 text-gray-600">
            The complete platform for youth basketball clubs, leagues, and families
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
