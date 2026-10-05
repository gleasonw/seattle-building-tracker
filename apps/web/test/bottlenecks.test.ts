/** Bottleneck measures against their drill-downs (SPEC X3). Runs against the local database. */
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@sbt/data/db/client";
import type { Filters } from "@/lib/filters";
import {
  bottleneckFilters,
  getOutcomes,
  getReviewBreakdown,
  getStageDurations,
  getStalledProjects,
} from "@/lib/server/bottlenecks";
import { listPermits } from "@/lib/server/permits";

afterAll(() => sql.end());

const list = (filters: Filters) => listPermits(filters, { sort: "date", dir: "desc", page: 1 });

describe.each<[string, Filters]>([
  ["citywide", {}],
  ["townhouses in one area", { type: ["townhouse"], area: ["12.3"] }],
])("%s", (_, filters) => {
  test("share-built cells equal their permit lists", async () => {
    const rows = await getOutcomes(filters);
    const byCell = new Map<string, { year: number; type: string; status: string; units: number; permits: number }>();
    for (const r of rows) {
      const key = `${r.year}|${r.housingType}|${r.status}`;
      const cell = byCell.get(key) ?? { year: r.year, type: r.housingType, status: r.status, units: 0, permits: 0 };
      cell.units += r.units;
      cell.permits += r.permits;
      byCell.set(key, cell);
    }
    const cells = [...byCell.values()].sort((a, b) => b.units - a.units).slice(0, 5);
    for (const c of cells) {
      const permits = await list({
        ...bottleneckFilters(filters),
        from: `${c.year}-01-01`,
        to: `${c.year}-12-31`,
        type: [c.type as never],
        status: [c.status as never],
      });
      expect(permits.totalUnits, `${c.year} ${c.type} ${c.status}`).toBe(c.units);
      expect(permits.totalPermits).toBe(c.permits);
    }
  });

  test("durations, review breakdown and stalled projects compute", async () => {
    const [durations, review, stalled] = await Promise.all([
      getStageDurations(filters),
      getReviewBreakdown(filters),
      getStalledProjects(filters),
    ]);
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) expect(d.p25 <= d.median && d.median <= d.p75).toBe(true);
    expect(review.every((r) => r.year >= 2018)).toBe(true);
    expect(stalled.rows.every((r) => r.daysInStage > r.slowDays || r.expiresDate)).toBe(true);
  });
});

test("project-grain drill-down counts the projects in a cohort", async () => {
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM projects pr
     WHERE pr.applied_date BETWEEN '2019-01-01' AND '2019-12-31'`;
  const permits = await list({ on: "applied", by: "project", from: "2019-01-01", to: "2019-12-31", units: null });
  expect(permits.totalProjects).toBe(row!.n);
});
