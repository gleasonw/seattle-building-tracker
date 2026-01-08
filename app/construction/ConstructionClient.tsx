"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ConstructionChart from "./ConstructionChart";
import RecordsTable from "../components/RecordsTable";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Button } from "../components/ui/button";
import { Calendar, MapPin, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SuggestionResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface MonthlyData {
  year: number;
  month: number;
  totalUnitsAdded: number;
}

interface QuarterlyData {
  year: number;
  quarter: number;
  totalUnitsAdded: number;
}

interface YearlyData {
  year: number;
  totalUnitsAdded: number;
}

interface Record {
  permitNum: string;
  appliedDate: string | null;
  completedDate: string | null;
  housingUnitsAdded: number | null;
  originalAddress1: string | null;
  permitTypeMapped: string | null;
  description: string | null;
  link: string | null;
  estProjectCost: string | null;
  latitude: string | null;
  longitude: string | null;
}

interface Props {
  trendsData: {
    monthlyData: MonthlyData[];
    quarterlyData: QuarterlyData[];
    yearlyData: YearlyData[];
  };
  records: Record[];
  initialParams: {
    start?: string;
    end?: string;
    sortBy?: string;
    sortOrder?: string;
    address?: string;
    radius?: string;
    lat?: string;
    lng?: string;
  };
}

export default function ConstructionClient({
  trendsData,
  records,
  initialParams,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Date filter state
  const [startDate, setStartDate] = useState(initialParams.start || "");
  const [endDate, setEndDate] = useState(initialParams.end || "");

  // Geographic filter state
  const [address, setAddress] = useState(initialParams.address || "");
  const [radius, setRadius] = useState(initialParams.radius || "0.5");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
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

  const handleApplyDateFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (startDate) {
      newParams.set("start", startDate);
    } else {
      newParams.delete("start");
    }
    if (endDate) {
      newParams.set("end", endDate);
    } else {
      newParams.delete("end");
    }
    router.push(`/construction?${newParams.toString()}`);
  };

  const handleApplyGeoFilter = async () => {
    setGeoError(null);

    if (!address.trim()) {
      setGeoError("Please enter an address");
      return;
    }

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

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("address", address);
      newParams.set("radius", radius);
      newParams.set("lat", lat);
      newParams.set("lng", lon);

      router.push(`/construction?${newParams.toString()}`);
    } catch (err) {
      setGeoError("Failed to geocode address. Please try again.");
      console.error("Geocoding error:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleRemoveDateFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("start");
    newParams.delete("end");
    setStartDate("");
    setEndDate("");
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
  const hasGeoFilter = initialParams.lat && initialParams.lng && initialParams.address;

  // Create Seattle Open Data Portal URL with filters
  const createSeattleDataUrl = () => {
    const baseUrl =
      "https://data.seattle.gov/Built-Environment/Building-Permits/76t5-zqzr/explore/query";

    const conditions = [
      "(`permittypemapped` IN ('Building', 'Demolition', 'Land Use'))",
      "`applieddate` IS NOT NULL",
      "`housingunitsadded` > 0",
    ];

    const dateField = "completeddate";

    if (startDate) {
      conditions.push(`\`${dateField}\` >= '${startDate}T00:00:00'`);
    }
    if (endDate) {
      conditions.push(`\`${dateField}\` <= '${endDate}T23:59:59'`);
    }

    const whereClause = conditions.join(" AND ");

    const sqlQuery = `SELECT
  *
WHERE ${whereClause}
ORDER BY \`${dateField}\` DESC`;

    return `${baseUrl}/${encodeURIComponent(sqlQuery)}/page/filter`;
  };

  const seattleDataUrl = createSeattleDataUrl();

  return (
    <>
      {/* Compact Filter Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="px-4 py-2">
                <Calendar className="w-4 h-4 mr-2" />
                Date Range
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Completion Date Filter</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button onClick={handleApplyDateFilter} className="w-full px-4 py-2">
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Geographic Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="px-4 py-2">
                <MapPin className="w-4 h-4 mr-2" />
                Location
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Geographic Search</h4>
                <div>
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
                {geoError && (
                  <div className="text-sm text-red-600">{geoError}</div>
                )}
                <Button
                  onClick={handleApplyGeoFilter}
                  disabled={isGeocoding}
                  className="w-full px-4 py-2"
                >
                  {isGeocoding ? "Searching..." : "Apply"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active Filters */}
        {(hasDateFilter || hasGeoFilter) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {hasDateFilter && (
                <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {initialParams.start && new Date(initialParams.start).toLocaleDateString()}
                    {initialParams.start && initialParams.end && " - "}
                    {initialParams.end && new Date(initialParams.end).toLocaleDateString()}
                  </span>
                  <button
                    onClick={handleRemoveDateFilter}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                    aria-label="Remove date filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {hasGeoFilter && (
                <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">
                  <MapPin className="w-3 h-3" />
                  <span className="max-w-xs truncate">{initialParams.address}</span>
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

      {/* Chart */}
      <ConstructionChart
        data={trendsData}
        startDate={initialParams.start}
        endDate={initialParams.end}
      />

      {/* Records Table */}
      <div className="mt-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Building Permit Records</h2>
          <a
            href={seattleDataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View in Seattle Open Data Portal →
          </a>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          {records.length} record{records.length !== 1 ? "s" : ""} found
        </div>
      </div>

      <RecordsTable records={records} initialParams={initialParams} />
    </>
  );
}
