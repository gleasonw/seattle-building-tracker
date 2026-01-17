"use client";

import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useFilters } from "@/app/hooks/useFilters";
import { buildingPermitLink } from "@/lib/utils";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";

export default function DateFieldToggle() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { getDateField } = useFilters();
  const dateField = getDateField();
  const params = Object.fromEntries(
    searchParams.entries()
  ) as Partial<BuildingDashSearchParams>;

  return (
    <div className="flex gap-1">
      <Link
        href={buildingPermitLink((pathname as "/" | "/applications") || "/", {
          ...params,
          dateField: "applied",
        })}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          dateField === "applied"
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
        }`}
      >
        First received
      </Link>
      <Link
        href={buildingPermitLink((pathname as "/" | "/applications") || "/", {
          ...params,
          dateField: "completed",
        })}
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
