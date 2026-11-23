/**
 * Invariant tests (SPEC T1): every number's project list adds up exactly to that number.
 * Runs against the local database (`DATABASE_URL` in .env.local) after a sync.
 */
import { sql as drizzleSql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@sbt/data/db/client";
import { HOUSING_TYPES } from "@sbt/data/domain/housing-type";
import type { Filters, Where } from "@/lib/filters";
import { periodFor } from "@/lib/period";
import { query } from "@/lib/server/db";
import { summarize, totalsBy } from "@/lib/server/metrics";
import { getMovement } from "@/lib/server/movement";
import { listProjects } from "@/lib/server/projects";
import { reportFilters } from "@/lib/server/report";
import { source, stageSql, UNLOCATED } from "@/lib/server/scope";

afterAll(() => sql.end());

const TODAY = "2026-11-22";

/** The full list behind a number, and the sum of its rows. */
async function fullList(filters: Filters) {
  const list = await listProjects(filters, TODAY, { limit: null });
  return {
    list,
    rowUnits: list.rows.reduce((s, r) => s + r.units, 0),
    rowPermits: list.rows.reduce((s, r) => s + r.permits, 0),
  };
}

async function expectListMatches(filters: Filters, label: string) {
  const [support, { list, rowUnits, rowPermits }] = await Promise.all([summarize(filters, TODAY), fullList(filters)]);
  expect(list.totalUnits, `${label}: list total`).toBe(support.totalUnits);
  expect(rowUnits, `${label}: sum of rows`).toBe(support.totalUnits);
  expect(rowPermits, `${label}: permits`).toBe(support.permitCount);
  expect(list.rows.length, `${label}: projects`).toBe(support.projectCount);
  return support;
}

describe("demolitions reporting units added", () => {
  test("exist in the data", async () => {
    const [row] = await query<{ n: number }>(drizzleSql`
      SELECT count(*)::int AS n FROM permits p
       WHERE p.removed_at IS NULL AND p.permit_type_mapped = 'Demolition' AND p.housing_units_added > 0
    `);
    expect(row!.n).toBeGreaterThan(0);
  });

  test.each(["completed", "issued", "applied", "outcome", "pipeline"] as const)("add nothing (%s)", async (m) => {
    for (const units of ["net", "added"] as const) {
      const [row] = await query<{ added: number }>(drizzleSql`
        SELECT coalesce(sum(src.added), 0)::int AS added
          FROM (${source({ m, units, from: "1990-01-01" }, TODAY)}) src JOIN permits p USING (permit_num)
         WHERE p.permit_type_mapped = 'Demolition'
      `);
      expect(row!.added, units).toBe(0);
    }
  });
});

describe("a recorded completion wins over the status, except for dead permits", () => {
  test("permits with a completion date and an Expired or Issued status exist", async () => {
    const [row] = await query<{ n: number }>(drizzleSql`
      SELECT count(*)::int AS n FROM permits p
       WHERE p.removed_at IS NULL AND p.completed_date IS NOT NULL AND p.status_category IN ('lapsed', 'pipeline')
    `);
    expect(row!.n).toBeGreaterThan(0);
  });

  test("completed totals count only completed, never dead, permits", async () => {
    for (const units of ["net", "added"] as const) {
      const [row] = await query<{ dead: number; notCompleted: number }>(drizzleSql`
        SELECT count(*) FILTER (WHERE p.status_category = 'dead' AND p.permit_type_mapped <> 'Demolition')::int AS dead,
               count(*) FILTER (WHERE src.added > 0 AND ${stageSql("p", TODAY)} <> 'completed')::int AS "notCompleted"
          FROM (${source({ m: "completed", units, from: "1990-01-01" }, TODAY)}) src JOIN permits p USING (permit_num)
      `);
      expect(row!.dead, units).toBe(0);
      expect(row!.notCompleted, units).toBe(0);
    }
  });

  test("a permit with a completion date leaves the pipeline and counts as completed in outcomes", async () => {
    const [pipe] = await query<{ n: number }>(drizzleSql`
      SELECT count(*)::int AS n FROM (${source({ m: "pipeline" }, TODAY)}) src JOIN permits p USING (permit_num)
       WHERE p.completed_date IS NOT NULL
    `);
    expect(pipe!.n).toBe(0);
    const [out] = await query<{ n: number }>(drizzleSql`
      SELECT count(*)::int AS n FROM (${source({ m: "outcome", from: "1990-01-01" }, TODAY)}) src JOIN permits p USING (permit_num)
       WHERE p.completed_date IS NOT NULL AND p.status_category <> 'dead' AND src.stage <> 'completed'
    `);
    expect(out!.n).toBe(0);
  });
});

const PLACES: [string, Where][] = [
  ["citywide", {}],
  ["Roosevelt", { hood: "roosevelt" }],
  ["Roosevelt Urban Center", { center: "roosevelt-urban-center" }],
  ["½ mile around 6716 Roosevelt Way NE", { lat: 47.67776, lng: -122.317, r: 0.5 }],
];

describe.each(PLACES)("%s", (_, where) => {
  const ytd = periodFor(2026, TODAY);
  const past = periodFor(2024, TODAY);
  const f = reportFilters(where, ytd);
  const fp = reportFilters(where, past);

  test("headline numbers equal their project lists", async () => {
    for (const [name, filters] of Object.entries({
      completed: f.completed,
      completedPrev: f.completedPrev,
      removed: f.removed,
      issued: f.issued,
      applied: f.applied,
      pipeline: f.pipeline,
      review: f.review,
      issuedPipeline: f.issuedPipeline,
      stalled: f.stalled,
      proposals: f.proposals,
    })) {
      await expectListMatches(filters, name);
    }
  });

  test("pipeline splits into in review and issued", async () => {
    const [total, review, issued] = await Promise.all([
      summarize(f.pipeline, TODAY),
      summarize(f.review, TODAY),
      summarize(f.issuedPipeline, TODAY),
    ]);
    expect((review.totalUnits ?? 0) + (issued.totalUnits ?? 0)).toBe(total.totalUnits);
    expect(review.projectCount + issued.projectCount).toBe(total.projectCount);
  });

  test("net completions are units added minus units removed", async () => {
    const [net, added, removed] = await Promise.all([
      summarize(f.completed, TODAY),
      summarize(f.added, TODAY),
      summarize(f.removed, TODAY),
    ]);
    expect(net.totalUnits).toBe((added.totalUnits ?? 0) - (removed.removedUnits ?? 0));
    expect(net.removedUnits).toBe(removed.removedUnits);
  });

  test("a past year's applications split into what happened to them", async () => {
    const applied = await summarize(fp.applied, TODAY);
    let sum = 0;
    for (const outcome of ["completed", "progress", "expired", "dead"] as const) {
      const s = await expectListMatches(fp.outcome(outcome), outcome);
      sum += s.totalUnits ?? 0;
    }
    expect(sum).toBe(applied.totalUnits);
  });

  test("housing-type slices equal their lists and add up to units added", async () => {
    const [types, added] = await Promise.all([totalsBy(f.added, TODAY, "ptype"), summarize(f.added, TODAY)]);
    expect(types.reduce((s, t) => s + t.units, 0)).toBe(added.totalUnits);
    for (const t of types) {
      expect(HOUSING_TYPES).toContain(t.key);
      const s = await summarize({ ...f.added, type: [t.key as never] }, TODAY);
      expect(s.totalUnits, t.key).toBe(t.units);
    }
  });

  test("long-view bars equal their lists", async () => {
    const years = await totalsBy({ ...where, m: "completed", units: "net", from: "2010-01-01", to: TODAY }, TODAY, "year");
    for (const y of [...years].sort((a, b) => Math.abs(b.units) - Math.abs(a.units)).slice(0, 3)) {
      const year = Number(y.key);
      const s = await summarize(f.longView(year, year === 2026 ? TODAY : `${year}-12-31`), TODAY);
      expect(s.totalUnits, y.key).toBe(y.units);
    }
  });

  test("movement deaths are only of projects that are dead now", async () => {
    const moves = await getMovement(where, TODAY, { days: 365 });
    const died = moves.filter((m) => m.kind === "died");
    if (!died.length) return;
    const rows = await query<{ stage: string }>(drizzleSql`
      SELECT ${stageSql("m", TODAY)} AS stage FROM projects pr JOIN permits m ON m.permit_num = pr.main_permit_num
       WHERE pr.project_key IN (${drizzleSql.join(died.map((d) => drizzleSql`${d.projectKey}`), drizzleSql`, `)})
    `);
    expect(rows.every((r) => r.stage === "dead")).toBe(true);
    for (const m of moves) expect(m.date <= TODAY).toBe(true);
  });
});

describe("neighborhood ranking", () => {
  test("rows plus unlocated add up to the citywide number, and each row equals its list", async () => {
    const f = reportFilters({}, periodFor(2026, TODAY));
    const [rows, city] = await Promise.all([totalsBy(f.completed, TODAY, "hood"), summarize(f.completed, TODAY)]);
    expect(rows.reduce((s, r) => s + r.units, 0)).toBe(city.totalUnits);
    const unlocated = rows.find((r) => r.key === null);
    if (unlocated) expect((await summarize({ ...f.completed, hood: UNLOCATED }, TODAY)).totalUnits).toBe(unlocated.units);
    for (const r of rows.filter((r) => r.key).slice(0, 5)) {
      const s = await summarize({ ...f.completed, hood: r.key }, TODAY);
      expect(s.totalUnits, r.key).toBe(r.units);
      expect(s.projectCount, r.key).toBe(r.projects);
    }
  });

  test("every located permit is in exactly one neighborhood or within 50 m of one", async () => {
    const [row] = await query<{ located: number; assigned: number; outside: number }>(drizzleSql`
      SELECT count(*)::int AS located, count(neighborhood_id)::int AS assigned,
             count(*) FILTER (WHERE neighborhood_id IS NULL
               AND EXISTS (SELECT 1 FROM places pl WHERE pl.kind = 'neighborhood' AND ST_Contains(pl.geom, p.geom)))::int AS outside
        FROM permits p WHERE p.removed_at IS NULL AND p.geom IS NOT NULL
    `);
    expect(row!.outside).toBe(0);
    expect(row!.assigned / row!.located).toBeGreaterThan(0.99);
  });
});
