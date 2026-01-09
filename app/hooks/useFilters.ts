"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";

export function useFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilterParams = (updates: Partial<BuildingDashSearchParams>) => {
    const newParams = new URLSearchParams(searchParams.toString());

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

  return {
    updateFilterParams,
    searchParams,
  };
}
