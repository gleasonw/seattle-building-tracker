import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Builds a link to a building permit page with query parameters
 * @param rootRoute The root route ('/' or '/applications')
 * @param params Query parameters to include in the URL
 * @param currentParams Optional current URLSearchParams to merge with (for preserving existing params)
 * @returns The constructed URL string
 */
export function buildingPermitLink(
  rootRoute: "/" | "/applications",
  params: Partial<BuildingDashSearchParams>,
  currentParams?: URLSearchParams
): string {
  const searchParams = currentParams
    ? new URLSearchParams(currentParams.toString())
    : new URLSearchParams();

  // Update/add all provided params
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      searchParams.delete(key);
    } else if (value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${rootRoute}?${queryString}` : rootRoute;
}
