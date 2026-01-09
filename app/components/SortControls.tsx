"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

interface SortOption {
  key: string;
  label: string;
}

interface SortControlsProps {
  sortOptions: SortOption[];
  currentSort?: string;
  currentOrder?: string;
}

export default function SortControls({
  sortOptions,
  currentSort,
  currentOrder,
}: SortControlsProps) {
  const searchParams = useSearchParams();

  const createSortUrl = (field: string, order: "asc" | "desc") => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("sortBy", field);
    newParams.set("sortOrder", order);
    return `?${newParams.toString()}`;
  };

  const isActive = (field: string, order: "asc" | "desc") => {
    return currentSort === field && currentOrder === order;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Sort By</h3>
      </div>
      <div className="space-y-2">
        {sortOptions.map((option) => (
          <div key={option.key} className="space-y-1">
            <div className="text-xs font-medium text-gray-500 px-3 py-1">
              {option.label}
            </div>
            <div className="flex gap-2">
              <Link
                href={createSortUrl(option.key, "desc")}
                scroll={false}
                className={`flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg border transition-colors ${
                  isActive(option.key, "desc")
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ArrowDown className="w-5 h-5" />
              </Link>
              <Link
                href={createSortUrl(option.key, "asc")}
                scroll={false}
                className={`flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg border transition-colors ${
                  isActive(option.key, "asc")
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ArrowUp className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
