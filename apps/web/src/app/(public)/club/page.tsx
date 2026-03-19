import { ClubSearch } from "../club-search"

export const metadata = {
  title: "Find a Basketball Club - Youth Basketball Hub",
  description: "Search and discover youth basketball clubs near you.",
}

export default function ClubDirectoryPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Basketball Club Directory
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Search by club name or city to find basketball programs near you.
        </p>
      </div>
      <ClubSearch />
    </div>
  )
}
