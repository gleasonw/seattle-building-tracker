"use client";

import { X } from "lucide-react";
import { useFilters } from "@/app/hooks/useFilters";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pipeline", label: "In Pipeline" },
  { value: "done", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

interface StatusCurrentFilterProps {
  currentValue?: string;
}

export default function StatusCurrentFilter({
  currentValue,
}: StatusCurrentFilterProps) {
  const { updateFilterParams } = useFilters();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-900">
          Application Status
        </label>
        {currentValue && (
          <button
            onClick={() => updateFilterParams({ statusCurrent: undefined })}
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
            statusCurrent: e.target.value || undefined,
          })
        }
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
    </div>
  );
}
