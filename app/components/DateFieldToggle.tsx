"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { useFilters } from "@/app/hooks/useFilters";

export default function DateFieldToggle() {
  const searchParams = useSearchParams();
  const { getDateField } = useFilters();
  const dateField = getDateField();
  const params = Object.fromEntries(searchParams.entries());

  return (
    <div className="flex gap-1">
      <Link
        href={`?${new URLSearchParams({
          ...params,
          dateField: "applied",
        }).toString()}`}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          dateField === "applied"
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
        }`}
      >
        First received
      </Link>
      <Link
        href={`?${new URLSearchParams({
          ...params,
          dateField: "completed",
        }).toString()}`}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          dateField === "completed"
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
        }`}
      >
        Completed
      </Link>
    </div>
  );
}
