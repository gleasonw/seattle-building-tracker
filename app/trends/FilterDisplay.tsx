"use client";

interface Props {
  params: {
    start?: string;
    end?: string;
    dateType?: "completed" | "applied";
    address?: string;
    radius?: string;
    lat?: string;
    lng?: string;
  };
  onRemoveFilter: (key: string) => void;
}

export default function FilterDisplay({ params, onRemoveFilter }: Props) {
  const hasFilters =
    params.start || params.end || (params.lat && params.lng && params.address);

  if (!hasFilters) {
    return null;
  }

  const handleRemoveDateFilter = () => {
    onRemoveFilter("start");
    onRemoveFilter("end");
  };

  const handleRemoveGeographicFilter = () => {
    onRemoveFilter("address");
    onRemoveFilter("radius");
    onRemoveFilter("lat");
    onRemoveFilter("lng");
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Active Filters</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {(params.start || params.end) && (
          <div className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full text-sm border border-gray-300">
            <span className="font-medium">Date Range:</span>
            <span>
              {params.start && new Date(params.start).toLocaleDateString()}
              {params.start && params.end && " - "}
              {params.end && new Date(params.end).toLocaleDateString()}
            </span>
            <span className="text-gray-500">
              ({params.dateType === "completed" ? "Completed" : "Applied"})
            </span>
            <button
              onClick={handleRemoveDateFilter}
              className="ml-1 text-gray-500 hover:text-gray-700"
              aria-label="Remove date filter"
            >
              ✕
            </button>
          </div>
        )}
        {params.lat && params.lng && params.address && (
          <div className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full text-sm border border-gray-300">
            <span className="font-medium">Location:</span>
            <span className="max-w-xs truncate">{params.address}</span>
            <span className="text-gray-500">
              (within {params.radius} mile{parseFloat(params.radius || "0") !== 1 ? "s" : ""})
            </span>
            <button
              onClick={handleRemoveGeographicFilter}
              className="ml-1 text-gray-500 hover:text-gray-700"
              aria-label="Remove geographic filter"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
