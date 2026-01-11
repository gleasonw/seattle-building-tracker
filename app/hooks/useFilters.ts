"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import { DEFAULT_DATE_FIELD } from "@/utils";

export function useFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilterParams = (updates: Partial<BuildingDashSearchParams>) => {
    const latestSearchParams = window.location.search;
    const newParams = new URLSearchParams(latestSearchParams);

    // Apply all updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });

    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  const getDateField = (): "applied" | "completed" => {
    return (
      (searchParams.get("dateField") as "applied" | "completed") ||
      DEFAULT_DATE_FIELD
    );
  };

  return {
    updateFilterParams,
    searchParams,
    getDateField,
  };
}
