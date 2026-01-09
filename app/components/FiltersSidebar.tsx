"use client";

import YearRangeSlider from "@/app/components/YearRangeSlider";
import { DEFAULT_START_DATE } from "@/server/src/query";
import { useQuery } from "@tanstack/react-query";
import { Search, Map, X, Calendar, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { useFilters } from "@/app/hooks/useFilters";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/app/components/LocationMap"), {
  ssr: false,
});

interface SuggestionResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface FiltersSidebarProps {
  initialParams: BuildingDashSearchParams;
  yearRangeLabel: React.ReactNode;
}

export default function FiltersSidebar({
  initialParams,
  yearRangeLabel,
}: FiltersSidebarProps) {
  const { updateFilterParams } = useFilters();

  // Date filter state
  const defaultStartDate = DEFAULT_START_DATE;
  const defaultEndDate = "2026-12-31";
  const startDate = initialParams.start || defaultStartDate;
  const endDate = initialParams.end || defaultEndDate;

  // Geographic filter state
  const [address, setAddress] = useState(initialParams.address || "");
  const [radius, setRadius] = useState(initialParams.radius || "0.5");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [geoTab, setGeoTab] = useState<"search" | "map">("map");
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const debouncedAddressChange = useDebounceCallback(setDebouncedAddress, 500);

  // Debounced auto-apply for radius
  const debouncedApplyRadius = useDebounceCallback((newRadius: string) => {
    if (initialParams.lat && initialParams.lng && initialParams.address) {
      updateFilterParams({ radius: newRadius });
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

    updateFilterParams({
      address: suggestion.display_name,
      lat: suggestion.lat,
      lng: suggestion.lon,
      radius,
    });
  };

  const handleMapLocationSelect = (
    lat: number,
    lng: number,
    addressText: string
  ) => {
    setAddress(addressText);

    updateFilterParams({
      address: addressText,
      lat: lat.toString(),
      lng: lng.toString(),
      radius,
    });
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

  const handleRemoveGeoFilter = () => {
    updateFilterParams({
      address: undefined,
      radius: undefined,
      lat: undefined,
      lng: undefined,
    });
    setAddress("");
    setRadius("0.5");
  };

  const hasDateFilter = initialParams.start || initialParams.end;
  const hasGeoFilter =
    initialParams.lat && initialParams.lng && initialParams.address;

  // Fetch autocomplete suggestions
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
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Filters</h2>

      {/* Date Range Filter */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          Date Range
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                {hasDateFilter ? (
                  <span className="font-medium">
                    {initialParams.start &&
                      new Date(initialParams.start).getFullYear()}
                    {initialParams.start && initialParams.end && " - "}
                    {initialParams.end &&
                      new Date(initialParams.end).getFullYear()}
                  </span>
                ) : (
                  <span className="text-gray-700">Select date range</span>
                )}
              </div>
              <Pencil className="w-3 h-3 text-gray-400" />
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
                    onClick={() =>
                      updateFilterParams({ start: undefined, end: undefined })
                    }
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
                  updateFilterParams({ start, end });
                }}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Geographic Filter */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-900">
            Location
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

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          <button
            onClick={() => setGeoTab("search")}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              geoTab === "search"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={() => setGeoTab("map")}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              geoTab === "map"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Map className="w-4 h-4" />
            Map
          </button>
        </div>

        {/* Search Tab */}
        {geoTab === "search" && (
          <>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
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
                  placeholder="e.g., 500 Union St"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${
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
          </>
        )}

        {/* Map Tab */}
        {geoTab === "map" && (
          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-3">
              Click or drag the marker to select a location
            </p>
            <LocationMap
              lat={
                initialParams.lat ? parseFloat(initialParams.lat) : undefined
              }
              lng={
                initialParams.lng ? parseFloat(initialParams.lng) : undefined
              }
              radius={parseFloat(radius)}
              onLocationSelect={handleMapLocationSelect}
            />
          </div>
        )}

        {/* Radius */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
