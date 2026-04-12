"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface Venue {
  id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  capacity?: number
}

interface VenueSelectorProps {
  value: string // venue ID or empty
  venueName: string // display name
  onSelect: (venue: { id: string; name: string; address: string }) => void
  onClear?: () => void
}

interface GooglePrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

export function VenueSelector({ value, venueName, onSelect, onClear }: VenueSelectorProps) {
  const [mode, setMode] = useState<"selected" | "search" | "google">(value ? "selected" : "search")
  const [query, setQuery] = useState("")
  const [existingVenues, setExistingVenues] = useState<Venue[]>([])
  const [googlePredictions, setGooglePredictions] = useState<GooglePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const autocompleteServiceRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)
  const [googleLoaded, setGoogleLoaded] = useState(false)

  // Load Google Places script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      console.warn("Google Places API key not configured")
      return
    }

    if (typeof window !== "undefined" && !(window as any).google?.maps?.places) {
      // Check if script already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const checkLoaded = setInterval(() => {
          if ((window as any).google?.maps?.places) {
            setGoogleLoaded(true)
            clearInterval(checkLoaded)
          }
        }, 200)
        return () => clearInterval(checkLoaded)
      }

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.onload = () => setGoogleLoaded(true)
      script.onerror = () => console.error("Failed to load Google Maps script")
      document.head.appendChild(script)
    } else {
      setGoogleLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (googleLoaded && (window as any).google?.maps?.places) {
      autocompleteServiceRef.current = new (window as any).google.maps.places.AutocompleteService()
      const div = document.createElement("div")
      placesServiceRef.current = new (window as any).google.maps.places.PlacesService(div)
    }
  }, [googleLoaded])

  // Search existing venues
  const searchExisting = useCallback(async (q: string) => {
    if (q.length < 2) { setExistingVenues([]); return }
    try {
      const res = await fetch(`/api/venues?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setExistingVenues(data.venues || [])
    } catch { setExistingVenues([]) }
  }, [])

  // Search Google Places
  const searchGoogle = useCallback((q: string) => {
    if (!autocompleteServiceRef.current || q.length < 3) {
      setGooglePredictions([])
      return
    }
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: q,
        types: ["establishment"],
        componentRestrictions: { country: ["ca", "us"] },
      },
      (predictions: GooglePrediction[] | null) => {
        setGooglePredictions(predictions || [])
      }
    )
  }, [])

  // Debounced search
  useEffect(() => {
    if (mode !== "search" && mode !== "google") return
    if (query.length < 2) {
      setExistingVenues([])
      setGooglePredictions([])
      setShowDropdown(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      searchExisting(query)
      searchGoogle(query)
      setShowDropdown(true)
      setLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, mode, searchExisting, searchGoogle])

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const selectExisting = (venue: Venue) => {
    onSelect({ id: venue.id, name: venue.name, address: `${venue.address}, ${venue.city}` })
    setMode("selected")
    setShowDropdown(false)
    setQuery("")
  }

  const selectGooglePlace = async (prediction: GooglePrediction) => {
    if (!placesServiceRef.current) return
    setCreating(true)

    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ["name", "formatted_address", "geometry", "address_components", "formatted_phone_number"] },
      async (place: any, status: string) => {
        if (status !== "OK" || !place) {
          setCreating(false)
          return
        }

        // Parse address components
        let city = "", state = "", zipCode = "", country = "CA"
        for (const comp of place.address_components || []) {
          if (comp.types.includes("locality")) city = comp.long_name
          if (comp.types.includes("administrative_area_level_1")) state = comp.short_name
          if (comp.types.includes("postal_code")) zipCode = comp.long_name
          if (comp.types.includes("country")) country = comp.short_name
        }

        try {
          const res = await fetch("/api/venues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: place.name || prediction.structured_formatting.main_text,
              address: place.formatted_address || prediction.description,
              city: city || "Unknown",
              state: state || "ON",
              zipCode: zipCode || undefined,
              country,
              phoneNumber: place.formatted_phone_number || undefined,
              placeId: prediction.place_id,
              latitude: place.geometry?.location?.lat(),
              longitude: place.geometry?.location?.lng(),
            }),
          })
          const data = await res.json()
          if (data.id) {
            onSelect({
              id: data.id,
              name: data.name || place.name,
              address: place.formatted_address || prediction.description,
            })
            setMode("selected")
            setShowDropdown(false)
            setQuery("")
          }
        } catch (err) {
          console.error("Failed to create venue:", err)
        } finally {
          setCreating(false)
        }
      }
    )
  }

  if (mode === "selected" && value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
        <div>
          <span className="text-sm font-medium text-gray-900">{venueName}</span>
        </div>
        <button
          type="button"
          onClick={() => { setMode("search"); onClear?.() }}
          className="text-xs text-orange-600 hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (existingVenues.length > 0 || googlePredictions.length > 0) setShowDropdown(true) }}
          placeholder="Search venue by name or address..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 pl-9 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {(loading || creating) && (
          <div className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-orange-500" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {/* Existing venues */}
          {existingVenues.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50">Existing Venues</div>
              {existingVenues.map((v) => (
                <button key={v.id} onClick={() => selectExisting(v)}
                  className="w-full px-3 py-2 text-left hover:bg-orange-50 border-b border-gray-50">
                  <div className="text-sm font-medium text-gray-900">{v.name}</div>
                  <div className="text-xs text-gray-500">{v.address}, {v.city}, {v.state}</div>
                </button>
              ))}
            </div>
          )}

          {/* Google Places */}
          {googlePredictions.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50">
                Add New from Google Maps
              </div>
              {googlePredictions.map((p) => (
                <button key={p.place_id} onClick={() => selectGooglePlace(p)}
                  disabled={creating}
                  className="w-full px-3 py-2 text-left hover:bg-green-50 border-b border-gray-50 disabled:opacity-50">
                  <div className="text-sm font-medium text-gray-900">{p.structured_formatting.main_text}</div>
                  <div className="text-xs text-gray-500">{p.structured_formatting.secondary_text}</div>
                </button>
              ))}
            </div>
          )}

          {existingVenues.length === 0 && googlePredictions.length === 0 && query.length >= 2 && !loading && (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No venues found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
