"use client";

import { Button } from "@/app/components/ui/button";
import YearRangeSlider from "@/app/components/YearRangeSlider";
import { SuggestionResult } from "@/app/construction/ConstructionClient";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

export type BuildingDashSearchParams = {
  start?: string;
  end?: string;
  tableStart?: string;
  tableEnd?: string;
  sortBy?: string;
  sortOrder?: string;
  address?: string;
  radius?: string;
  lat?: string;
  lng?: string;
};

export function PermitRowFilters({
  initialParams,
}: {
  initialParams: BuildingDashSearchParams;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Year filter state - convert URL params to years, default to 2010-2026
  const startParamYear = initialParams.start
    ? new Date(initialParams.start).getFullYear()
    : 2010;
  const endParamYear = initialParams.end
    ? new Date(initialParams.end).getFullYear()
    : 2026;
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Geographic filter state
  const [address, setAddress] = useState(initialParams.address || "");
  const [radius, setRadius] = useState(initialParams.radius || "0.5");
  const [startYear, setStartYear] = useState(startParamYear);
  const [endYear, setEndYear] = useState(endParamYear);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const debouncedAddressChange = useDebounceCallback(setDebouncedAddress, 500);

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
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
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

  const handleApplyAllFilters = async () => {
    const newParams = new URLSearchParams(searchParams.toString());

    // Apply year filter
    const startDateStr = `${startYear}-01-01`;
    const endDateStr = `${endYear}-12-31`;
    newParams.set("start", startDateStr);
    newParams.set("end", endDateStr);

    // Apply geo filter if address is provided
    if (address.trim()) {
      setGeoError(null);
      setIsGeocoding(true);

      try {
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
          setGeoError("Address not found. Please try a different address.");
          setIsGeocoding(false);
          return;
        }

        const { lat, lon } = data[0];
        newParams.set("address", address);
        newParams.set("radius", radius);
        newParams.set("lat", lat);
        newParams.set("lng", lon);
      } catch (err) {
        setGeoError("Failed to geocode address. Please try again.");
        console.error("Geocoding error:", err);
        setIsGeocoding(false);
        return;
      } finally {
        setIsGeocoding(false);
      }
    }

    // Push all parameters at once
    router.push(`?${newParams.toString()}`);
  };

  const handleRemoveYearFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("start");
    newParams.delete("end");
    router.push(`/construction?${newParams.toString()}`);
  };

  const handleRemoveGeoFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("address");
    newParams.delete("radius");
    newParams.delete("lat");
    newParams.delete("lng");
    setAddress("");
    setRadius("0.5");
    router.push(`/construction?${newParams.toString()}`);
  };

  const hasDateFilter = initialParams.start || initialParams.end;
  const hasGeoFilter =
    initialParams.lat && initialParams.lng && initialParams.address;

  // Fetch autocomplete suggestions using React Query
  const { data: suggestions = [], isFetching } = useQuery({
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

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Filter Permits
      </h3>

      <div className="flex flex-col gap-1">
        <div className="flex gap-10 flex-wrap">
          <div className="flex flex-col gap-3 w-80">
            <YearRangeSlider
              minYear={2010}
              maxYear={2026}
              startYear={startYear}
              endYear={endYear}
              onChange={(start, end) => {
                setStartYear(start);
                setEndYear(end);
              }}
            />
          </div>

          {/* Geographic Filter Popover */}
          <div className="flex gap-3 items-baseline">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    debouncedAddressChange(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="e.g., 500 Union St, Seattle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isFetching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.place_id}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          index === selectedIndex ? "bg-blue-100" : ""
                        }`}
                      >
                        {suggestion.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {geoError && <div className="text-sm text-red-600">{geoError}</div>}
          </div>
        </div>
        <Button
          onClick={handleApplyAllFilters}
          disabled={isGeocoding}
          className="w-fit h-11 px-4"
        >
          {isGeocoding ? "Applying..." : "Apply"}
        </Button>
      </div>

      {/* Active Filters */}
      {(hasDateFilter || hasGeoFilter) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            {hasDateFilter && (
              <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">
                <Calendar className="w-3 h-3" />
                <span>
                  {initialParams.start &&
                    new Date(initialParams.start).getFullYear()}
                  {initialParams.start && initialParams.end && " - "}
                  {initialParams.end &&
                    new Date(initialParams.end).getFullYear()}
                </span>
                <button
                  onClick={handleRemoveYearFilter}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                  aria-label="Remove year filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {hasGeoFilter && (
              <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">
                <MapPin className="w-3 h-3" />
                <span className="max-w-xs truncate">
                  {initialParams.address}
                </span>
                <span className="text-gray-500">
                  (within {initialParams.radius} mile
                  {parseFloat(initialParams.radius || "0") !== 1 ? "s" : ""})
                </span>
                <button
                  onClick={handleRemoveGeoFilter}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                  aria-label="Remove geographic filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
