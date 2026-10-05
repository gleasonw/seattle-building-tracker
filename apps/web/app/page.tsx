import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { HOUSING_TYPES } from "@sbt/data/domain/housing-type";
import { ComparisonCard } from "@/components/comparison-card";
import { FilterBar } from "@/components/filter-bar";
import { TrailingChart } from "@/components/charts/trailing-chart";
import { UnitsByYearChart, type YearDatum } from "@/components/charts/units-by-year-chart";
import { PolicyEventList } from "@/components/policy-event-list";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isoDate, permitsHref, pickFilters, type Filters } from "@/lib/filters";
import { formatDate, formatNumber, housingTypeLabel } from "@/lib/format";
import { canDerive } from "@/lib/reliability";
import {
  getMonthlyWithTrailing,
  getPolicyEvents,
  getSupport,
  getTopPermits,
  getTypeSourceShares,
  getUnitsByYearAndType,
  getYearToDate,
} from "@/lib/server/metrics";
import { listAreas, listSubTypes } from "@/lib/server/permits";
import { dateRange } from "@/lib/server/scope";
import { filtersCache } from "@/lib/server/search-params";

const MILESTONE = "completed" as const;

function lastTwelveMonths(today: Date) {
  const end = isoDate(today);
  const start = new Date(today);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() + 1);
  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(start);
  prevStart.setUTCFullYear(prevStart.getUTCFullYear() - 1);
  return { current: { from: isoDate(start), to: end }, previous: { from: isoDate(prevStart), to: isoDate(prevEnd) } };
}

/** V1 Output: how much are we building, and what kind? */
export default async function OutputPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The Output view always measures completions, so the milestone and status filters don't apply.
  const filters: Filters = { ...pickFilters(await filtersCache.parse(searchParams)), on: null, status: null };
  const segment: Filters = { ...filters, from: null, to: null };
  const today = new Date();
  const year = today.getUTCFullYear();
  const t12 = lastTwelveMonths(today);

  const [byYear, monthly, ytd, applied, t12Current, t12Previous, top, rangeSupport, shares, events, areas, subTypes] =
    await Promise.all([
      getUnitsByYearAndType(filters, MILESTONE),
      getMonthlyWithTrailing(filters, MILESTONE),
      getYearToDate(segment, MILESTONE, today),
      getYearToDate(segment, "applied", today),
      getSupport({ ...segment, ...t12.current }, MILESTONE),
      getSupport({ ...segment, ...t12.previous }, MILESTONE),
      getTopPermits(filters, MILESTONE),
      getSupport(filters, MILESTONE),
      getTypeSourceShares(filters, MILESTONE),
      getPolicyEvents(),
      listAreas(),
      listSubTypes(),
    ]);

  const { from, to } = dateRange(filters);
  const years = [...new Set(byYear.map((r) => r.year))].sort((a, b) => a - b);
  const chartData: YearDatum[] = years.map((y) => {
    const row: YearDatum = { year: y, label: y === year ? `${y} (so far)` : String(y), provisional: y === year };
    for (const t of HOUSING_TYPES) row[t] = 0;
    for (const r of byYear.filter((r) => r.year === y)) row[r.housingType] = r.units;
    return row;
  });
  const visibleEvents = events.filter((e) => e.date >= from && e.date <= to);
  // Charts show numbered markers; events in the same year (or month) share one marker.
  const markers = (key: (date: string) => string) => {
    const grouped = new Map<string, number[]>();
    visibleEvents.forEach((e, i) => grouped.set(key(e.date), [...(grouped.get(key(e.date)) ?? []), i + 1]));
    return [...grouped].map(([k, n]) => ({ key: k, label: n.join(", ") }));
  };
  const total = rangeSupport.totalUnits ?? 0;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">How much housing is Seattle building?</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Units added by building permits as they reach completion (final inspection). Gross units added; net of
          demolitions is coming once the demolition data is validated.
        </p>
      </div>

      <FilterBar areas={areas.map((a) => ({ value: a.id, label: a.name }))} subTypes={subTypes} />

      <div className="grid gap-4 md:grid-cols-3">
        <ComparisonCard
          title="Units completed, last 12 months"
          current={t12Current}
          previous={t12Previous}
          currentHref={permitsHref({ ...segment, ...t12.current, on: MILESTONE })}
          previousHref={permitsHref({ ...segment, ...t12.previous, on: MILESTONE })}
          previousLabel="in the 12 months before"
        />
        <ComparisonCard
          title={`Units completed, ${year} so far`}
          current={ytd.current}
          previous={ytd.previous}
          currentHref={permitsHref({ ...segment, from: ytd.current.from, to: ytd.current.to, on: MILESTONE })}
          previousHref={permitsHref({ ...segment, from: ytd.previous.from, to: ytd.previous.to, on: MILESTONE })}
          previousLabel={`by the same date in ${year - 1}`}
          provisional="Provisional: completions are sometimes recorded late."
        />
        <ComparisonCard
          title={`Units applied for, ${year} so far`}
          current={applied.current}
          previous={applied.previous}
          currentHref={permitsHref({ ...segment, from: applied.current.from, to: applied.current.to, on: "applied" })}
          previousHref={permitsHref({ ...segment, from: applied.previous.from, to: applied.previous.to, on: "applied" })}
          previousLabel={`by the same date in ${year - 1}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Units completed per year, by housing type</CardTitle>
          <CardDescription>
            Look for which kinds of housing drive the totals and how the mix shifts after policy changes. Click a bar to
            see its permits.
          </CardDescription>
          <CardAction>
            <ReliabilityBadge support={rangeSupport} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <UnitsByYearChart
            data={chartData}
            filters={filters}
            milestone={MILESTONE}
            annotations={markers((d) => d.slice(0, 4)).map((m) => ({ year: Number(m.key), label: m.label }))}
          />
          <PolicyEventList events={visibleEvents} />
          <p className="text-muted-foreground text-xs">
            {Math.round(shares.inferredShare * 100)}% of these units have a housing type inferred from the permit
            description because the City didn&apos;t record one; {Math.round(shares.unknownShare * 100)}% couldn&apos;t be
            classified.{" "}
            <Link href="/methodology#housing-type" className="underline underline-offset-2">
              How types are assigned
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trailing 12-month total</CardTitle>
          <CardDescription>
            Units completed in the 12 months up to each month. Smooths out seasonal swings, so it&apos;s the fairest way
            to tell whether the city is speeding up or slowing down.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrailingChart
            data={monthly.map((m) => ({ month: m.month, trailing12: m.trailing12 }))}
            annotations={markers((d) => `${d.slice(0, 7)}-01`).map((m) => ({ month: m.key, label: m.label }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Largest completions</CardTitle>
          <CardDescription>
            The biggest permits completed between {formatDate(from)} and {formatDate(to)}, and their share of the{" "}
            {formatNumber(total)} units in that period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((p) => (
                <TableRow key={p.permitNum}>
                  <TableCell>
                    <div className="font-medium">{p.address ?? p.permitNum}</div>
                    <div className="text-muted-foreground max-w-md truncate text-xs">{p.description}</div>
                  </TableCell>
                  <TableCell>{housingTypeLabel(p.housingType)}</TableCell>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.units)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {canDerive(rangeSupport) && total ? `${((p.units / total) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Link
            href={permitsHref({ ...filters, on: MILESTONE })}
            className="text-muted-foreground mt-3 inline-block text-xs hover:underline underline-offset-2"
          >
            All {formatNumber(rangeSupport.permitCount)} permits in this period →
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
