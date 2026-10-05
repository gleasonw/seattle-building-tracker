import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { HOUSING_TYPE_LABELS, HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";
import { CohortChart, type CohortDatum } from "@/components/charts/cohort-chart";
import { FunnelChart, type FunnelDatum } from "@/components/charts/funnel-chart";
import { ReviewChart, type ReviewDatum } from "@/components/charts/review-chart";
import { FilterBar } from "@/components/filter-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FUNNEL_SEGMENTS } from "@/lib/chart-config";
import { hrefWith, permitsHref, pickFilters, type Filters } from "@/lib/filters";
import { formatDate, formatNumber } from "@/lib/format";
import { MIN_PROJECTS } from "@/lib/reliability";
import {
  bottleneckFilters,
  getCohortProjects,
  getOutcomes,
  getPooledDurations,
  getProvisionalCutoffs,
  getReviewBreakdown,
  getStageDurations,
  isProvisionalCohort,
  REVIEW_DATA_START_YEAR,
} from "@/lib/server/bottlenecks";
import { listAreas, listSubTypes } from "@/lib/server/permits";
import { dateRange } from "@/lib/server/scope";
import { filtersCache } from "@/lib/server/search-params";

export const metadata: Metadata = { title: "Bottlenecks · Seattle Housing Tracker" };

type Series = HousingType | "all";

/** V3 Bottlenecks: which kinds of projects stall or die, and at which stage? */
export default async function BottlenecksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = bottleneckFilters(pickFilters(await filtersCache.parse(searchParams)));
  const today = new Date();

  const [outcomes, cohortProjects, durations, review, cutoffs, areas, subTypes] = await Promise.all([
    getOutcomes(filters),
    getCohortProjects(filters),
    getStageDurations(filters),
    getReviewBreakdown(filters),
    getProvisionalCutoffs(),
    listAreas(),
    listSubTypes(),
  ]);
  const { from, to } = dateRange(filters);

  const provisional = (year: number, series: Series) => isProvisionalCohort(year, cutoffs.get(series) ?? cutoffs.get("all")!, today);
  const years = [...new Set(outcomes.map((o) => o.year))].sort((a, b) => a - b);
  const typesPresent = HOUSING_TYPES.filter((t) => outcomes.some((o) => o.housingType === t));
  const firstProvisional = (series: Series[]) => {
    const ys = years.filter((y) => series.some((s) => provisional(y, s)));
    return ys.length ? Math.min(...ys) : null;
  };
  const settledThrough = (() => {
    const p = firstProvisional(["all"]);
    return p == null ? (years.at(-1) ?? today.getUTCFullYear()) : p - 1;
  })();

  // Funnel: every cohort in range, per type and in total.
  const funnelRow = (label: string, type: HousingType | null): FunnelDatum => {
    const rows = outcomes.filter((o) => type == null || o.housingType === type);
    const row: FunnelDatum = {
      label,
      drilldown: { ...filters, type: type ? [type] : filters.type },
      total: rows.reduce((s, r) => s + r.units, 0),
      deadAfterIssue: rows.filter((r) => r.stage === "dead_issued").reduce((s, r) => s + r.units, 0),
    };
    for (const seg of FUNNEL_SEGMENTS) {
      row[seg] = rows
        .filter((r) => (seg === "dead" ? r.status === "dead" : r.stage === seg))
        .reduce((s, r) => s + r.units, 0);
    }
    return row;
  };
  const funnel = [funnelRow("All types", null), ...typesPresent.map((t) => funnelRow(HOUSING_TYPE_LABELS[t], t))];

  // Share built (M4): built ÷ (applied − lapsed), withheld below the reliability threshold.
  const projectsFor = (year: number, type: HousingType | null) =>
    cohortProjects.find((c) => c.year === year && c.housingType === type)?.projects ?? 0;
  const shareBuilt = (year: number, type: HousingType | null) => {
    if (projectsFor(year, type) < MIN_PROJECTS) return null;
    const rows = outcomes.filter((o) => o.year === year && (type == null || o.housingType === type));
    const done = rows.filter((r) => r.status === "done").reduce((s, r) => s + r.units, 0);
    const counted = rows.filter((r) => r.status !== "lapsed").reduce((s, r) => s + r.units, 0);
    return counted ? done / counted : null;
  };
  const shareData: CohortDatum[] = years.map((year) => {
    const d: CohortDatum = { year, all: shareBuilt(year, null) };
    for (const t of typesPresent) d[t] = shareBuilt(year, t);
    return d;
  });

  // Durations (M5): medians per cohort and type, withheld below the threshold.
  const durationData = (stage: "applied_to_issued" | "issued_to_completed"): CohortDatum[] =>
    years.map((year) => {
      const d: CohortDatum = { year };
      for (const r of durations.filter((r) => r.year === year && r.stage === stage)) {
        d[r.housingType ?? "all"] = r.projects >= MIN_PROJECTS ? r.median : null;
      }
      return d;
    });
  const pooled = await getPooledDurations(filters, settledThrough);
  const pooledFor = (type: HousingType | null, stage: string) => pooled.find((p) => p.housingType === type && p.stage === stage);

  const reviewData: ReviewDatum[] = review.map((r) => {
    const ok = r.projects >= MIN_PROJECTS;
    return {
      year: r.year,
      housingType: r.housingType ?? "all",
      projects: r.projects,
      cityDays: ok ? r.cityDays : null,
      applicantDays: ok ? r.applicantDays : null,
      cycles: ok ? r.cycles : null,
    };
  });

  const projectDrilldown: Filters = { ...filters, by: "project" };
  const shareProvisional = firstProvisional(["all", ...typesPresent]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Where do projects get stuck?</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          What happened to housing applied for between {formatDate(from)} and {formatDate(to)}: how much got built, how long
          each stage took, and where projects died. Dates on this page are application dates.
        </p>
      </div>

      <FilterBar areas={areas.map((a) => ({ value: a.id, label: a.name }))} subTypes={subTypes} />

      <Card>
        <CardHeader>
          <CardTitle>Where applied-for units ended up</CardTitle>
          <CardDescription>
            Look for types where much of the housing dies or lapses rather than being slow. Recent applications are mostly
            still in progress. Click a segment to see its permits.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <FunnelChart data={funnel} />
          <p className="text-muted-foreground text-xs">
            Lapsed permits were issued and then expired. The project may have stalled, finished without a final inspection,
            or continued under another permit, so they&apos;re shown on their own.{" "}
            <Link href="/methodology#status" className="underline underline-offset-2">
              Status categories
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share built, by year applied</CardTitle>
          <CardDescription>
            Of the units applied for each year, the share that has been completed (lapsed permits left out). In settled years, a
            falling line means more of the housing applied for died or is still stuck. Click a year to see its permits.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CohortChart
            data={shareData}
            format="percent"
            provisionalFrom={shareProvisional}
            drilldown={filters}
            domain={[0, 1]}
          />
          <p className="text-muted-foreground text-xs">
            Shaded years are provisional: projects of that type usually take longer than that to finish, so their share
            built will rise. Points are left out when fewer than {MIN_PROJECTS} projects are behind them.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Median days from application to issue</CardTitle>
            <CardDescription>Per project, from its first application to its last building permit being issued.</CardDescription>
          </CardHeader>
          <CardContent>
            <CohortChart
              data={durationData("applied_to_issued")}
              format="days"
              provisionalFrom={firstProvisional(["all", ...typesPresent])}
              drilldown={projectDrilldown}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Median days from issue to completion</CardTitle>
            <CardDescription>Per project, from its last permit being issued to its last building finishing.</CardDescription>
          </CardHeader>
          <CardContent>
            <CohortChart
              data={durationData("issued_to_completed")}
              format="days"
              provisionalFrom={firstProvisional(["all", ...typesPresent])}
              drilldown={projectDrilldown}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Typical time per stage, by housing type</CardTitle>
          <CardDescription>
            Median days with the middle half of projects (25th–75th percentile), for applications through {settledThrough}.
            Later years are left out because their slowest projects haven&apos;t finished yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Application → issue</TableHead>
                <TableHead className="text-right">Issue → completion</TableHead>
                <TableHead className="text-right">Projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[null, ...typesPresent].map((t) => {
                const a = pooledFor(t, "applied_to_issued");
                const c = pooledFor(t, "issued_to_completed");
                const cell = (d: typeof a) =>
                  d && d.projects >= MIN_PROJECTS ? (
                    <>
                      <span className="font-medium">{formatNumber(d.median)}</span>
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({formatNumber(d.p25)}–{formatNumber(d.p75)})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">not enough data</span>
                  );
                return (
                  <TableRow key={t ?? "all"}>
                    <TableCell className={t ? "" : "font-medium"}>{t ? HOUSING_TYPE_LABELS[t] : "All types"}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(a)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(c)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Link
                        className="hover:underline underline-offset-2"
                        href={permitsHref({ ...projectDrilldown, to: `${settledThrough}-12-31`, type: t ? [t] : filters.type })}
                      >
                        {formatNumber(a?.projects ?? 0)}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who is the wait on? City review vs. applicant corrections</CardTitle>
          <CardDescription>
            Median days the City spent reviewing plans, and days the plans were back with the applicant for corrections, on
            each project&apos;s main permit. The City has only recorded this split since {REVIEW_DATA_START_YEAR}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewChart data={reviewData} drilldown={{ ...projectDrilldown, from: `${REVIEW_DATA_START_YEAR}-01-01` }} />
        </CardContent>
      </Card>

      <Link href={hrefWith("/stalled", { ...filters, on: null, from: null, to: null })} className="text-sm underline underline-offset-2">
        See which projects are stuck right now →
      </Link>
    </>
  );
}
