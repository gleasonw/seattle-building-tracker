"use client";

import { X } from "lucide-react";
import { useFilters } from "@/app/hooks/useFilters";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Additional Info Requested", label: "Additional Info Requested" },
  { value: "Application Completed", label: "Application Completed" },
  { value: "Approved to Occupy", label: "Approved to Occupy" },
  { value: "Awaiting Information", label: "Awaiting Information" },
  { value: "Canceled", label: "Canceled" },
  { value: "Closed", label: "Closed" },
  { value: "Completed", label: "Completed" },
  { value: "Corrections Required", label: "Corrections Required" },
  { value: "Corrections Submitted", label: "Corrections Submitted" },
  { value: "Denied", label: "Denied" },
  { value: "Expired", label: "Expired" },
  { value: "Initiated", label: "Initiated" },
  { value: "Inspections Completed", label: "Inspections Completed" },
  { value: "Issued", label: "Issued" },
  { value: "Phase Issued", label: "Phase Issued" },
  { value: "Ready for Intake", label: "Ready for Intake" },
  { value: "Ready for Issuance", label: "Ready for Issuance" },
  { value: "Reviews Completed", label: "Reviews Completed" },
  { value: "Reviews In Process", label: "Reviews In Process" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Withdrawn", label: "Withdrawn" },
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
