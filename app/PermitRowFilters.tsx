"use client";

import YearRangeSlider from "@/app/components/YearRangeSlider";
import { DEFAULT_START_DATE } from "@/server/src/query";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, X, Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";

interface SuggestionResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export type BuildingDashSearchParams = {
  start?: string;
  end?: string;
  sortBy?: string;
  sortOrder?: string;
  address?: string;
  radius?: string;
  lat?: string;
  lng?: string;
};

export function PermitRowFilters({
  initialParams,
  yearRangeLabel,
}: {
  initialParams: BuildingDashSearchParams;
  yearRangeLabel: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Date filter state - default to 2010-01-01 to 2026-12-31
  const defaultStartDate = DEFAULT_START_DATE;
  const defaultEndDate = "2026-12-31";
  const startDate = initialParams.start || defaultStartDate;
  const endDate = initialParams.end || defaultEndDate;

  // Geographic filter state
  const [address, setAddress] = useState(initialParams.address || "");
  const [radius, setRadius] = useState(initialParams.radius || "0.5");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const debouncedAddressChange = useDebounceCallback(setDebouncedAddress, 500);

  // Auto-apply date range filter (debouncing happens in YearRangeSlider)
  const applyDateFilter = (startDate: string, endDate: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("start", startDate);
    newParams.set("end", endDate);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  // Debounced auto-apply for radius
  const debouncedApplyRadius = useDebounceCallback((newRadius: string) => {
    if (initialParams.lat && initialParams.lng && initialParams.address) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("radius", newRadius);
      router.push(`?${newParams.toString()}`, { scroll: false });
    }
  }, 800);

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

    // Auto-apply the geographic filter
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("address", suggestion.display_name);
    newParams.set("radius", radius);
    newParams.set("lat", suggestion.lat);
    newParams.set("lng", suggestion.lon);
    router.push(`?${newParams.toString()}`, { scroll: false });
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

  const handleRemoveYearFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("start");
    newParams.delete("end");
    router.push(`/construction?${newParams.toString()}`, { scroll: false });
  };

  const handleRemoveGeoFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("address");
    newParams.delete("radius");
    newParams.delete("lat");
    newParams.delete("lng");
    setAddress("");
    setRadius("0.5");
    router.push(`/construction?${newParams.toString()}`, { scroll: false });
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
    <div className="mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date Range Filter Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <Calendar className="w-4 h-4 text-gray-600" />
              {hasDateFilter ? (
                <>
                  <span className="font-medium">
                    {initialParams.start &&
                      new Date(initialParams.start).getFullYear()}
                    {initialParams.start && initialParams.end && " - "}
                    {initialParams.end &&
                      new Date(initialParams.end).getFullYear()}
                  </span>
                  <Pencil className="w-3 h-3 text-gray-400" />
                </>
              ) : (
                <span className="text-gray-700">Date Range</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-6" align="start">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-900">
                  {yearRangeLabel}
                </label>
                {hasDateFilter && (
                  <button
                    onClick={handleRemoveYearFilter}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              <YearRangeSlider
                minYear={2010}
                maxYear={2026}
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  applyDateFilter(start, end);
                }}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Geographic Filter Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <MapPin className="w-4 h-4 text-gray-600" />
              {hasGeoFilter ? (
                <>
                  <span className="font-medium max-w-[200px] truncate">
                    {initialParams.address}
                  </span>
                  <span className="text-gray-500 text-xs">
                    ({initialParams.radius}mi)
                  </span>
                  <Pencil className="w-3 h-3 text-gray-400" />
                </>
              ) : (
                <span className="text-gray-700">Location</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-6" align="start">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-900">
                  Geographic Filter
                </label>
                {hasGeoFilter && (
                  <button
                    onClick={handleRemoveGeoFilter}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
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
                  onChange={(e) => {
                    setRadius(e.target.value);
                    debouncedApplyRadius(e.target.value);
                  }}
                  min="0.1"
                  max="10"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
