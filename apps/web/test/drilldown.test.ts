/**
 * Invariant tests (DEV_REWRITE_SPEC §7, SPEC X3): for sampled filter combinations, the
 * permit list behind a number adds up exactly to that number. Run against the local
 * database (`DATABASE_URL` in .env.local) after a sync.
 */
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@sbt/data/db/client";
import type { Filters } from "@/lib/filters";
import { getMonthlyWithTrailing, getSupport, getUnitsByYearAndType } from "@/lib/server/metrics";
import { listPermits } from "@/lib/server/permits";

afterAll(() => sql.end());

const SAMPLES: [string, Filters][] = [
  ["citywide, net completions", {}],
  ["one year, removals only", { from: "2017-01-01", to: "2017-12-31", units: "removed" }],
  ["townhouses, net", { type: ["townhouse"], from: "2020-01-01", to: "2024-12-31" }],
  ["large multifamily, min units", { type: ["mf_large", "mf_mid"], min: 100 }],
  ["two areas, applied", { area: ["12.3", "11.3"], on: "applied" }],
  ["one area, net, housing type", { area: ["9.3"], type: ["townhouse", "adu"] }],
  ["radius around Pike Place", { lat: 47.6097, lng: -122.3422, r: 1 }],
  ["status and sub-type, issued", { on: "issued", status: ["pipeline"], sub: ["New"] }],
  ["permit type filter, net (removals matched via project)", { sub: ["New"], from: "2015-01-01" }],
];

const list = (filters: Filters) => listPermits(filters, { sort: "date", dir: "desc", page: 1 });

describe.each(SAMPLES)("%s", (_, filters) => {
  test("aggregate equals its drill-down list", async () => {
    const [support, permits] = await Promise.all([getSupport(filters), list(filters)]);
    expect(permits.totalUnits).toBe(support.totalUnits);
    expect(permits.totalPermits).toBe(support.permitCount);
    expect(permits.totalProjects).toBe(support.projectCount);
  });

  test("each chart cell equals its drill-down list", async () => {
    const on = filters.on ?? "completed";
    const rows = await getUnitsByYearAndType(filters, on);
    // Check a few cells (the largest, so they're non-trivial) to keep the run short.
    const cells = [...rows].sort((a, b) => Math.abs(b.units) - Math.abs(a.units)).slice(0, 4);
    for (const cell of cells) {
      const year = { from: `${cell.year}-01-01`, to: `${cell.year}-12-31` };
      const clamp = {
        from: filters.from && filters.from > year.from ? filters.from : year.from,
        to: filters.to && filters.to < year.to ? filters.to : year.to,
      };
      const drill: Filters =
        cell.series === "removed"
          ? { ...filters, ...clamp, units: "removed" }
          : { ...filters, ...clamp, type: [cell.series], units: "added" };
      const permits = await list(drill);
      expect(permits.totalUnits, `${cell.year} ${cell.series}`).toBe(cell.units);
    }
  });

  test("monthly series sums to the total", async () => {
    const on = filters.on ?? "completed";
    const [months, support] = await Promise.all([getMonthlyWithTrailing(filters, on), getSupport(filters)]);
    expect(months.reduce((s, m) => s + m.units, 0)).toBe(support.totalUnits);
  });
});
