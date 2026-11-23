/**
 * Every view setting lives in the URL (SPEC T7). These parsers are the single definition,
 * shared by server components (via lib/server/search-params.ts) and links.
 */
import {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";
import { MOVEMENT_PERIODS, type MovementPeriod } from "@/lib/rules";

/** What a number counts (SPEC §3). */
export const MEASURES = ["completed", "issued", "applied", "pipeline", "proposals", "outcome"] as const;
export type Measure = (typeof MEASURES)[number];

/** Which units a completion count includes. Net is the headline (SPEC §2). */
export const UNIT_KINDS = ["net", "added", "removed"] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

/** Stages (SPEC §2 "Stage"), plus proposals that haven't formally applied. */
export const STAGES = ["proposal", "review", "issued", "completed", "expired", "dead"] as const;
export type Stage = (typeof STAGES)[number];
export const PIPELINE_STAGES = ["review", "issued"] as const satisfies readonly Stage[];
/**
 * Stages a pipeline list can ask for. "expired" adds projects whose permit has expired while
 * the City still lists them as issued: shown in place reports' pipeline tables with their
 * flag, but never counted in the pipeline.
 */
export const PIPELINE_LIST_STAGES = ["review", "issued", "expired"] as const satisfies readonly Stage[];
export type PipelineStage = (typeof PIPELINE_LIST_STAGES)[number];

export const FLAGS = ["stalled", "expiring"] as const;
export type Flag = (typeof FLAGS)[number];

/** What has since happened to a period's applications (SPEC P1 "Past years"). */
export const OUTCOMES = ["completed", "progress", "expired", "dead"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const PIPELINE_SORTS = ["units", "time", "movement"] as const;
export type PipelineSort = (typeof PIPELINE_SORTS)[number];

/** A place to count in: a neighborhood, a center, or a radius around a point. */
export interface Where {
  hood?: string | null;
  center?: string | null;
  lat?: number | null;
  lng?: number | null;
  r?: number | null;
}

/** A number on the page: a measure, a period and a place. Its project list uses the same filters. */
export interface Filters extends Where {
  m?: Measure | null;
  from?: string | null;
  to?: string | null;
  units?: UnitKind | null;
  type?: HousingType[] | null;
  stage?: PipelineStage[] | null;
  flag?: Flag | null;
  outcome?: Outcome | null;
  /** Label for a radius, e.g. the address it's around. */
  label?: string | null;
}

/** Whether a string is a real calendar date as YYYY-MM-DD (2026-02-30 is not). */
export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** YYYY-MM-DD that is a real date; anything else is ignored. */
export const parseAsIsoDate = createParser({
  parse: (v: string) => (isIsoDate(v) ? v : null),
  serialize: (v: string) => v,
});

const inRange = (min: number, max: number) =>
  createParser({
    parse: (v: string) => {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? n : null;
    },
    serialize: (n: number) => String(n),
  });

const parseAsSlug = createParser({
  parse: (v: string) => (/^[a-z0-9-]{1,80}$/.test(v) ? v : null),
  serialize: (v: string) => v,
});

/** Places: bad values are ignored, never an error (latitude and longitude roughly around Seattle). */
export const whereParsers = {
  hood: parseAsSlug,
  center: parseAsSlug,
  lat: inRange(47, 48.5),
  lng: inRange(-123, -121.5),
  r: inRange(0.01, 3),
};

export const filterParsers = {
  ...whereParsers,
  m: parseAsStringLiteral(MEASURES),
  from: parseAsIsoDate,
  to: parseAsIsoDate,
  units: parseAsStringLiteral(UNIT_KINDS),
  type: parseAsArrayOf(parseAsStringLiteral(HOUSING_TYPES)),
  stage: parseAsArrayOf(parseAsStringLiteral(PIPELINE_LIST_STAGES)),
  flag: parseAsStringLiteral(FLAGS),
  outcome: parseAsStringLiteral(OUTCOMES),
  label: parseAsString,
};

export const listParsers = {
  sort: parseAsStringLiteral(["units", "address"] as const).withDefault("units"),
  page: createParser({
    parse: (v: string) => (/^\d{1,6}$/.test(v) && Number(v) >= 1 ? Number(v) : null),
    serialize: (n: number) => String(n),
  }).withDefault(1),
};

/** Settings of the front page and place reports. */
export const reportParsers = {
  year: createParser({
    parse: (v: string) => (/^\d{4}$/.test(v) ? Number(v) : null),
    serialize: (n: number) => String(n),
  }),
  sort: parseAsStringLiteral(PIPELINE_SORTS).withDefault("units"),
  moves: parseAsStringLiteral(Object.keys(MOVEMENT_PERIODS) as MovementPeriod[]).withDefault("6m"),
  all: parseAsBoolean.withDefault(false),
  /** Development only: pretend today is this date (lib/server/today.ts). */
  asof: parseAsIsoDate,
};

export function pickFilters(parsed: Filters & Record<string, unknown>): Filters {
  const { hood, center, lat, lng, r, m, from, to, units, type, stage, flag, outcome, label } = parsed;
  return { hood, center, lat, lng, r, m, from, to, units, type, stage, flag, outcome, label };
}

export function pickWhere(f: Where): Where {
  return { hood: f.hood ?? null, center: f.center ?? null, lat: f.lat ?? null, lng: f.lng ?? null, r: f.r ?? null };
}

const serializeProjects = createSerializer({ ...filterParsers, ...listParsers });

/** The project list behind a number (SPEC T1). */
export function projectsHref(filters: Filters, extra: { sort?: "units" | "address"; page?: number } = {}): string {
  return serializeProjects("/projects", { ...filters, ...extra });
}

const serializeReport = createSerializer({ ...whereParsers, ...reportParsers, label: parseAsString });

/** A place report: a named place, or a radius around a point (labelled with what it's around). */
export function placeHref(
  place: { kind: "neighborhood" | "center"; id: string } | { lat: number; lng: number; r: number; label: string },
  settings: { year?: number | null; sort?: PipelineSort; moves?: MovementPeriod; all?: boolean; asof?: string | null } = {},
): string {
  if ("id" in place) return serializeReport(`/place/${place.id}`, settings);
  const { lat, lng, r, label } = place;
  return serializeReport(`/near/${encodeURIComponent(label)}`, {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    r,
    ...settings,
  });
}

/** A project, by any of its permit numbers. */
export const projectHref = (permitNum: string) => `/project/${encodeURIComponent(permitNum)}`;
