/**
 * Every filter and view setting lives in the URL (SPEC T7). These parsers are the single
 * definition, shared by server components (via the cache in lib/server/search-params.ts)
 * and client components (via useQueryStates).
 */
import {
  createSerializer,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { HOUSING_TYPES } from "@sbt/data/domain/housing-type";
import { STATUS_CATEGORIES } from "@sbt/data/domain/status";

export const MILESTONES = ["applied", "issued", "completed"] as const;
export type Milestone = (typeof MILESTONES)[number];

export const SORT_FIELDS = ["date", "units", "permit"] as const;

/** Earliest year shown by default (SPEC open question 6). */
export const DEFAULT_START = "2010-01-01";

export const filterParsers = {
  from: parseAsString,
  to: parseAsString,
  on: parseAsStringLiteral(MILESTONES),
  status: parseAsArrayOf(parseAsStringLiteral(STATUS_CATEGORIES)),
  type: parseAsArrayOf(parseAsStringLiteral(HOUSING_TYPES)),
  area: parseAsArrayOf(parseAsString),
  lat: parseAsFloat,
  lng: parseAsFloat,
  r: parseAsFloat,
  min: parseAsInteger,
  sub: parseAsArrayOf(parseAsString),
};

export const listParsers = {
  sort: parseAsStringLiteral(SORT_FIELDS).withDefault("date"),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  page: parseAsInteger.withDefault(1),
};

export type Filters = {
  from?: string | null;
  to?: string | null;
  on?: Milestone | null;
  status?: (typeof STATUS_CATEGORIES)[number][] | null;
  type?: (typeof HOUSING_TYPES)[number][] | null;
  area?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  r?: number | null;
  min?: number | null;
  sub?: string[] | null;
};

/** The filter subset of parsed search params (drops list settings like sort and page). */
export function pickFilters(parsed: Filters & Record<string, unknown>): Filters {
  const { from, to, on, status, type, area, lat, lng, r, min, sub } = parsed;
  return { from, to, on, status, type, area, lat, lng, r, min, sub };
}

const serialize = createSerializer({ ...filterParsers, ...listParsers });

/** Link to the permit list behind a number (SPEC X3). */
export function permitsHref(filters: Filters): `/permits${string}` {
  return serialize("/permits", filters) as `/permits${string}`;
}

/** Same filters on another route. */
export function hrefWith(path: string, filters: Filters): string {
  return serialize(path, filters);
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
