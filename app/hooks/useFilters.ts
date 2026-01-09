"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function useFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateDateRange = (startDate: string, endDate: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("start", startDate);
    newParams.set("end", endDate);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  const updateGeoFilter = (
    address: string,
    lat: string,
    lng: string,
    radius: string
  ) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("address", address);
    newParams.set("lat", lat);
    newParams.set("lng", lng);
    newParams.set("radius", radius);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  const removeDateFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("start");
    newParams.delete("end");
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  const removeGeoFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("address");
    newParams.delete("radius");
    newParams.delete("lat");
    newParams.delete("lng");
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set(key, value);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  return {
    updateDateRange,
    updateGeoFilter,
    removeDateFilter,
    removeGeoFilter,
    updateParam,
    searchParams,
  };
}
