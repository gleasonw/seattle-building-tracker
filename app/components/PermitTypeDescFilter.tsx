"use client";

import { X } from "lucide-react";
import { useFilters } from "@/app/hooks/useFilters";

const PERMIT_TYPES = [
  { value: "", label: "All Types" },
  { value: "New", label: "New" },
  { value: "Addition/Alteration", label: "Addition/Alteration" },
  { value: "Demolition", label: "Demolition" },
  { value: "Tenant Improvment", label: "Tenant Improvement" },
  { value: "Temporary", label: "Temporary" },
  { value: "Change of Use Only - No Construction", label: "Change of Use" },
  { value: "Curb Cut", label: "Curb Cut" },
  { value: "Deconstruction", label: "Deconstruction" },
  { value: "Relocation", label: "Relocation" },
];

interface PermitTypeDescFilterProps {
  currentValue?: string;
}

export default function PermitTypeDescFilter({
  currentValue,
}: PermitTypeDescFilterProps) {
  const { updateFilterParams } = useFilters();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-900">
          Permit Type
        </label>
        {currentValue && (
          <button
            onClick={() => updateFilterParams({ permitTypeDesc: undefined })}
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
            permitTypeDesc: e.target.value || undefined,
          })
        }
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {PERMIT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
    </div>
  );
}
