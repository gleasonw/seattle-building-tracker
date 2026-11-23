import "server-only";
import { HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";
import type { Filters, Outcome, Where } from "@/lib/filters";
import type { Period } from "@/lib/period";
import type { Support } from "@/lib/reliability";
import { LONG_VIEW_START } from "@/lib/rules";
import { getTypeSourceShares, summarize, totalsBy } from "./metrics";
import { listProjects, type ProjectRow } from "./projects";
import { hasPlace } from "./scope";

/** The filters behind each number of a year report, so every number links to its own list. */
export function reportFilters(where: Where, period: Period) {
  const cur = { from: period.from, to: period.to };
  const prev = period.previous;
  return {
    completed: { ...where, m: "completed", units: "net", ...cur },
    completedPrev: { ...where, m: "completed", units: "net", ...prev },
    removed: { ...where, m: "completed", units: "removed", ...cur },
    issued: { ...where, m: "issued", ...cur },
    issuedPrev: { ...where, m: "issued", ...prev },
    applied: { ...where, m: "applied", ...cur },
    appliedPrev: { ...where, m: "applied", ...prev },
    added: { ...where, m: "completed", units: "added", ...cur },
    pipeline: { ...where, m: "pipeline" },
    pipelineTable: { ...where, m: "pipeline", stage: ["review", "issued", "expired"] },
    expiredStillIssued: { ...where, m: "pipeline", stage: ["expired"] },
    review: { ...where, m: "pipeline", stage: ["review"] },
    issuedPipeline: { ...where, m: "pipeline", stage: ["issued"] },
    stalled: { ...where, m: "pipeline", flag: "stalled" },
    proposals: { ...where, m: "proposals" },
    outcome: (outcome: Outcome) => ({ ...where, m: "outcome", ...cur, outcome }),
    appliedAll: { ...where, m: "outcome", ...cur },
    longView: (year: number, to: string) => ({
      ...where,
      m: "completed",
      units: "net",
      from: `${year}-01-01`,
      to: year === period.year && period.ytd ? to : `${year}-12-31`,
    }),
  } satisfies Record<string, Filters | ((...args: never[]) => Filters)>;
}

export interface Comparison {
  current: Support;
  previous: Support;
}

export interface TypeSlice {
  type: HousingType;
  units: number;
  projects: number;
}

export interface YearPoint {
  year: number;
  units: number;
  projects: number;
  /** Share of the city's net completions that year (places only). */
  share: number | null;
  shareProjects: number;
}

export interface YearReport {
  completed: Comparison;
  issued: Comparison;
  applied: Comparison;
  pipeline: { total: Support; review: Support; issued: Support; stalled: Support } | null;
  outcomes: Record<Outcome, Support> | null;
  types: TypeSlice[];
  typeShares: { inferredShare: number; unknownShare: number };
  biggestCompleted: ProjectRow[];
  biggestIssued: ProjectRow[];
  longView: YearPoint[];
}

/** Everything the front page and a place report show about one year (SPEC P1, P3). */
export async function getYearReport(where: Where, period: Period, today: string): Promise<YearReport> {
  const f = reportFilters(where, period);
  const longFrom = `${LONG_VIEW_START}-01-01`;
  const [
    completed,
    completedPrev,
    issued,
    issuedPrev,
    applied,
    appliedPrev,
    pipeline,
    outcomes,
    typeTotals,
    typeShares,
    biggestCompleted,
    biggestIssued,
    years,
    cityYears,
  ] = await Promise.all([
    summarize(f.completed, today),
    summarize(f.completedPrev, today),
    summarize(f.issued, today),
    summarize(f.issuedPrev, today),
    summarize(f.applied, today),
    summarize(f.appliedPrev, today),
    period.ytd
      ? Promise.all([
          summarize(f.pipeline, today),
          summarize(f.review, today),
          summarize(f.issuedPipeline, today),
          summarize(f.stalled, today),
        ]).then(([total, review, issued, stalled]) => ({ total, review, issued, stalled }))
      : null,
    period.ytd
      ? null
      : Promise.all((["completed", "progress", "expired", "dead"] as const).map((o) => summarize(f.outcome(o), today))).then(
          ([completed, progress, expired, dead]) => ({ completed: completed!, progress: progress!, expired: expired!, dead: dead! }),
        ),
    totalsBy(f.added, today, "ptype"),
    getTypeSourceShares(f.added, today),
    listProjects(f.added, today, { limit: 5 }).then((l) => l.rows),
    listProjects(f.issued, today, { limit: 5 }).then((l) => l.rows),
    totalsBy({ ...where, m: "completed", units: "net", from: longFrom, to: today }, today, "year"),
    hasPlace(where) ? totalsBy({ m: "completed", units: "net", from: longFrom, to: today }, today, "year") : null,
  ]);

  const byType = new Map(typeTotals.map((t) => [t.key, t]));
  const types = HOUSING_TYPES.map((type) => ({
    type,
    units: byType.get(type)?.units ?? 0,
    projects: byType.get(type)?.projects ?? 0,
  }));

  const byYear = new Map(years.map((y) => [Number(y.key), y]));
  const cityByYear = new Map((cityYears ?? []).map((y) => [Number(y.key), y]));
  const currentYear = Number(today.slice(0, 4));
  const longView: YearPoint[] = [];
  for (let y = LONG_VIEW_START; y <= currentYear; y++) {
    const row = byYear.get(y);
    const city = cityByYear.get(y);
    longView.push({
      year: y,
      units: row?.units ?? 0,
      projects: row?.projects ?? 0,
      share: city && city.units > 0 ? (row?.units ?? 0) / city.units : null,
      shareProjects: row?.projects ?? 0,
    });
  }

  return {
    completed: { current: completed, previous: completedPrev },
    issued: { current: issued, previous: issuedPrev },
    applied: { current: applied, previous: appliedPrev },
    pipeline,
    outcomes,
    types,
    typeShares,
    biggestCompleted,
    biggestIssued,
    longView,
  };
}
