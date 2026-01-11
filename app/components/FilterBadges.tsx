"use client";

import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useFilters } from "@/app/hooks/useFilters";
import Link from "next/link";

export default function FilterBadges() {
  const searchParams = useSearchParams();
  const { updateFilterParams } = useFilters();

  // Get active filters
  const getActiveFilters = () => {
    const filters: Array<{ key: string; label: string; value: string[] }> = [];

    // Date range filter
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const dateField = searchParams.get("dateField") || "applied";
    if (start || end) {
      const startYear = start ? new Date(start).getFullYear() : "";
      const endYear = end ? new Date(end).getFullYear() : "";
      filters.push({
        key: "dateRange",
        label: `${startYear} - ${endYear}`,
        value: ["start", "end"],
      });
    }

    // Location filter
    const address = searchParams.get("address");
    const radius = searchParams.get("radius");
    if (address) {
      filters.push({
        key: "location",
        label: `${address} (${radius || "0.5"} mi)`,
        value: ["address", "lat", "lng", "radius"],
      });
    }

    // Permit type filter
    const permitTypeDesc = searchParams.get("permitTypeDesc");
    if (permitTypeDesc) {
      filters.push({
        key: "permitTypeDesc",
        label: `Type: ${permitTypeDesc}`,
        value: ["permitTypeDesc"],
      });
    }

    // Status filter
    const statusCurrent = searchParams.get("statusCurrent");
    if (statusCurrent) {
      const statusLabels: Record<string, string> = {
        pipeline: "In Pipeline",
        done: "Completed",
        canceled: "Canceled",
      };
      filters.push({
        key: "statusCurrent",
        label: `Status: ${statusLabels[statusCurrent] || statusCurrent}`,
        value: ["statusCurrent"],
      });
    }

    // Housing units filter
    const housingUnitsAddedMin = searchParams.get("housingUnitsAddedMin");
    if (housingUnitsAddedMin) {
      filters.push({
        key: "housingUnitsAddedMin",
        label: `Units: ${housingUnitsAddedMin}+`,
        value: ["housingUnitsAddedMin"],
      });
    }

    return filters;
  };

  const removeFilter = (filterKeys: string[]) => {
    const updates: Record<string, undefined> = {};
    filterKeys.forEach((key) => {
      updates[key] = undefined;
    });
    updateFilterParams(updates);
  };

  const activeFilters = getActiveFilters();

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {activeFilters.map((filter) => {
        // Special rendering for date range filter with toggle
        if (filter.key === "dateRange") {
          const dateField = searchParams.get("dateField") || "applied";
          const params = Object.fromEntries(searchParams.entries());

          return (
            <div
              key={filter.key}
              className="inline-flex items-center gap-2 px-2.5 py-1 text-sm bg-blue-50 text-blue-700 rounded-full"
            >
              <span>{filter.label}</span>
              <div className="flex gap-1 border-l border-blue-300 pl-2">
                <Link
                  href={`?${new URLSearchParams({
                    ...params,
                    dateField: "applied",
                  }).toString()}`}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    dateField === "applied"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  Applied
                </Link>
                <Link
                  href={`?${new URLSearchParams({
                    ...params,
                    dateField: "completed",
                  }).toString()}`}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    dateField === "completed"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  Completed
                </Link>
              </div>
              <button
                onClick={() => removeFilter(filter.value)}
                className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        }

        // Regular filter badges
        return (
          <button
            key={filter.key}
            onClick={() => removeFilter(filter.value)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
          >
            {filter.label}
            <X className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}
