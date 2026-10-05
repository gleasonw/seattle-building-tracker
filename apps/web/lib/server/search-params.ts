import "server-only";
import { createSearchParamsCache } from "nuqs/server";
import { filterParsers, listParsers } from "@/lib/filters";

export const filtersCache = createSearchParamsCache({ ...filterParsers, ...listParsers });
