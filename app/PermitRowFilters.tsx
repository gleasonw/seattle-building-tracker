"use client";

import YearRangeSlider from "@/app/components/YearRangeSlider";
import LocationMap from "@/app/components/LocationMap";
import { DEFAULT_START_DATE } from "@/server/src/query";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, X, Pencil, Search, Map } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { useFilters } from "@/app/hooks/useFilters";

interface SuggestionResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export type BuildingDashSearchParams = {
  start?: string;
  end?: string;
  period?: string;
  sortBy?: string;
  sortOrder?: string;
  address?: string;
  radius?: string;
  lat?: string;
  lng?: string;
  permitTypeDesc?: string;
  statusCurrent?: string;
  housingUnitsAddedMin?: string;
  dateField?: "applied" | "completed";
};

export function PermitRowFilters({
  initialParams,
  yearRangeLabel,
}: {
  initialParams: BuildingDashSearchParams;
  yearRangeLabel: React.ReactNode;
}) {
  const { updateFilterParams } = useFilters();

  // Date filter state - default to 2010-01-01 to 2026-12-31
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

    // Auto-apply the geographic filter
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

    // Auto-apply the geographic filter
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
          <PopoverContent className="w-[500px] p-6" align="start">
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

              {/* Tabs */}
              <div className="flex gap-2 border-b border-gray-200">
                <button
                  onClick={() => setGeoTab("search")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    geoTab === "search"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  Search Address
                </button>
                <button
                  onClick={() => setGeoTab("map")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    geoTab === "map"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Map className="w-4 h-4" />
                  Select on Map
                </button>
              </div>

              {/* Search Tab */}
              {geoTab === "search" && (
                <>
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
                </>
              )}

              {/* Map Tab */}
              {geoTab === "map" && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Click or drag the marker to select a location
                  </p>
                  <LocationMap
                    lat={
                      initialParams.lat
                        ? parseFloat(initialParams.lat)
                        : undefined
                    }
                    lng={
                      initialParams.lng
                        ? parseFloat(initialParams.lng)
                        : undefined
                    }
                    radius={parseFloat(radius)}
                    onLocationSelect={handleMapLocationSelect}
                  />
                </div>
              )}

              {/* Radius - shown for both tabs */}
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
