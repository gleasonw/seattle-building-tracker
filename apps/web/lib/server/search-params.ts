import "server-only";
import { createSearchParamsCache, parseAsString } from "nuqs/server";
import { filterParsers, listParsers, parseAsIsoDate, reportParsers, whereParsers } from "@/lib/filters";

export const filtersCache = createSearchParamsCache({ ...filterParsers, ...listParsers, asof: parseAsIsoDate });
export const reportCache = createSearchParamsCache({ ...whereParsers, ...reportParsers, label: parseAsString });
