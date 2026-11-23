/**
 * Invariant tests (SPEC X3): for sampled filter combinations, the
 * permit list behind a number adds up exactly to that number. Run against the local
 * database (`DATABASE_URL` in .env.local) after a sync.
 */
import { sql as drizzleSql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@sbt/data/db/client";
import type { Filters } from "@/lib/filters";
import { getMonthlyWithTrailing, getSupport, getUnitsByYearAndType } from "@/lib/server/metrics";
import { listPermits } from "@/lib/server/permits";
import { query } from "@/lib/server/db";
import { scope } from "@/lib/server/scope";

afterAll(() => sql.end());

/**
 * Some demolition permits report the replacement building's units as "added" (e.g. 6880831-DM,
 * 6959231-DM and 6959238-DM, 734 each). Make sure the local data has such rows, so the
 * "never add units" check below isn't vacuous, and that none of them counts anywhere.
 */
describe("demolitions reporting units added", () => {
  test("exist in the data", async () => {
    const [row] = await query<{ n: number }>(drizzleSql`
      SELECT count(*)::int AS n FROM permits p
       WHERE p.removed_at IS NULL AND p.permit_type_mapped = 'Demolition' AND p.housing_units_added > 0
    `);
    expect(row!.n).toBeGreaterThan(0);
  });

  test.each(["applied", "issued", "completed"] as const)("add nothing, any date (%s)", async (milestone) => {
    for (const units of ["net", "added"] as const) {
      const s = scope({}, { milestone, units, ignoreDates: true });
      const [row] = await query<{ added: number }>(drizzleSql`
        SELECT coalesce(sum(${s.added}), 0)::int AS added FROM permits p
         WHERE ${s.where} AND p.permit_type_mapped = 'Demolition'
      `);
      expect(row!.added, units).toBe(0);
    }
  });
});

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

  test("demolition permits never add units (SPEC §3)", async () => {
    for (const units of ["net", "added"] as const) {
      const s = scope(filters, { units });
      const [row] = await query<{ added: number }>(drizzleSql`
        SELECT coalesce(sum(${s.added}), 0)::int AS added FROM permits p
         WHERE ${s.where} AND p.permit_type_mapped = 'Demolition'
      `);
      expect(row!.added, units).toBe(0);
    }
  });

  test("monthly series sums to the total", async () => {
    const on = filters.on ?? "completed";
    const [months, support] = await Promise.all([getMonthlyWithTrailing(filters, on), getSupport(filters)]);
    expect(months.reduce((s, m) => s + m.units, 0)).toBe(support.totalUnits);
  });
});
