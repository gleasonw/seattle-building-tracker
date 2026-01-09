"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateDateRange = useCallback(
    (startDate: string, endDate: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("start", startDate);
      newParams.set("end", endDate);
      router.push(`?${newParams.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const updateGeoFilter = useCallback(
    (address: string, lat: string, lng: string, radius: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("address", address);
      newParams.set("lat", lat);
      newParams.set("lng", lng);
      newParams.set("radius", radius);
      router.push(`?${newParams.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const removeDateFilter = useCallback(() => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("start");
    newParams.delete("end");
    router.push(`?${newParams.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const removeGeoFilter = useCallback(() => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("address");
    newParams.delete("radius");
    newParams.delete("lat");
    newParams.delete("lng");
    router.push(`?${newParams.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set(key, value);
      router.push(`?${newParams.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    updateDateRange,
    updateGeoFilter,
    removeDateFilter,
    removeGeoFilter,
    updateParam,
    searchParams,
  };
}
