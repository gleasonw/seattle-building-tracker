"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface SuggestionResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function GeographicSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [address, setAddress] = useState(searchParams.get("address") || "");
  const [radius, setRadius] = useState(searchParams.get("radius") || "0.5");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce address input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAddress(address);
    }, 300);
    return () => clearTimeout(timer);
  }, [address]);

  // Fetch autocomplete suggestions using React Query
  const {
    data: suggestions = [],
    isFetching,
    isLoading,
  } = useQuery({
    queryKey: ["addressAutocomplete", debouncedAddress],
    queryFn: async () => {
      if (debouncedAddress.trim().length < 3) {
        return [];
      }

      const encodedAddress = encodeURIComponent(
        debouncedAddress.includes("Seattle")
          ? debouncedAddress
          : `${debouncedAddress}, Seattle, WA`
      );
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&addressdetails=1`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      return (await response.json()) as SuggestionResult[];
    },
    enabled: debouncedAddress.trim().length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update showSuggestions when suggestions change
  useEffect(() => {
    if (debouncedAddress.trim().length >= 3) {
      setShowSuggestions(suggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, debouncedAddress]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: SuggestionResult) => {
    setAddress(suggestion.display_name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowSuggestions(false);

    if (!address.trim()) {
      setError("Please enter an address");
      return;
    }

    setIsGeocoding(true);

    try {
      // Use Nominatim (OpenStreetMap) for geocoding
      const encodedAddress = encodeURIComponent(
        address.includes("Seattle") ? address : `${address}, Seattle, WA`
      );
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`
      );

      if (!response.ok) {
        throw new Error("Geocoding service error");
      }

      const data = await response.json();

      if (data.length === 0) {
        setError("Address not found. Please try a different address.");
        setIsGeocoding(false);
        return;
      }

      const { lat, lon } = data[0];

      // Build new URL with all existing params plus geographic params
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("address", address);
      newParams.set("radius", radius);
      newParams.set("lat", lat);
      newParams.set("lng", lon);

      router.push(`/records?${newParams.toString()}`);
    } catch (err) {
      setError("Failed to geocode address. Please try again.");
      console.error("Geocoding error:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleClear = () => {
    setAddress("");
    setRadius("0.5");
    setError(null);

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("address");
    newParams.delete("radius");
    newParams.delete("lat");
    newParams.delete("lng");

    router.push(`/records?${newParams.toString()}`);
  };

  const hasGeographicFilter = searchParams.has("lat") && searchParams.has("lng");

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="font-semibold mb-3">Geographic Search</h3>
      <form onSubmit={handleSearch} className="flex flex-col gap-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="e.g., 500 Union St, Seattle"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.place_id}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      index === selectedIndex
                        ? "bg-blue-100"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {suggestion.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Radius (miles)
            </label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min="0.1"
              max="10"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={isGeocoding}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors font-medium"
            >
              {isGeocoding ? "Searching..." : "Search"}
            </button>
            {hasGeographicFilter && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
        {hasGeographicFilter && (
          <div className="text-sm text-gray-600">
            Showing permits within {searchParams.get("radius")} mile{parseFloat(searchParams.get("radius") || "0") !== 1 ? "s" : ""} of{" "}
            <span className="font-medium">{searchParams.get("address")}</span>
          </div>
        )}
      </form>
    </div>
  );
}
