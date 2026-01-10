"use client";

import { X } from "lucide-react";
import { useFilters } from "@/app/hooks/useFilters";

const HOUSING_UNITS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1+" },
  { value: "5", label: "5+" },
  { value: "10", label: "10+" },
  { value: "20", label: "20+" },
  { value: "50", label: "50+" },
  { value: "100", label: "100+" },
];

interface HousingUnitsFilterProps {
  currentValue?: string;
}

export default function HousingUnitsFilter({
  currentValue,
}: HousingUnitsFilterProps) {
  const { updateFilterParams } = useFilters();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-900">
          Housing Units Added
        </label>
        {currentValue && (
          <button
            onClick={() =>
              updateFilterParams({ housingUnitsAddedMin: undefined })
            }
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      <select
        value={currentValue || ""}
        onChange={(e) =>
          updateFilterParams({
            housingUnitsAddedMin: e.target.value || undefined,
          })
        }
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {HOUSING_UNITS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
