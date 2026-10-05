import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { StreetViewLink } from "@/components/street-view-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pickFilters, projectHref } from "@/lib/filters";
import { formatDate, formatNumber, housingTypeLabel } from "@/lib/format";
import {
  bottleneckFilters,
  EXPIRING_WITHIN_DAYS,
  getStalledProjects,
  STALLED_PERCENTILE,
} from "@/lib/server/bottlenecks";
import { listAreas, listSubTypes } from "@/lib/server/permits";
import { filtersCache } from "@/lib/server/search-params";

export const metadata: Metadata = { title: "Stalled projects · Seattle Housing Tracker" };

const SHOWN = 200;

const years = (days: number) => (days >= 365 ? `${(days / 365).toFixed(1)} yr` : `${days} days`);

/** V5 Stalled: which real projects are stuck? */
export default async function StalledPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Stalled is a snapshot of today's pipeline, so date filters don't apply.
  const filters = { ...bottleneckFilters(pickFilters(await filtersCache.parse(searchParams))), from: null, to: null };
  const [stalled, areas, subTypes] = await Promise.all([getStalledProjects(filters, SHOWN), listAreas(), listSubTypes()]);
  const pct = Math.round(STALLED_PERCENTILE * 100);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Which projects are stuck?</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Projects still in the pipeline that have spent longer in their current stage than {pct}% of past projects of the
          same type, or whose issued permit expires within {EXPIRING_WITHIN_DAYS} days. Ranked by units at risk.
        </p>
      </div>

      <FilterBar areas={areas} subTypes={subTypes} showDates={false} />

      <Card>
        <CardHeader>
          <CardTitle className="tabular-nums">
            {formatNumber(stalled.units)} units in {formatNumber(stalled.total)} stuck projects
          </CardTitle>
          <CardDescription>
            &ldquo;Typical&rdquo; is the median time past projects of the same type spent in the stage; a project is listed once
            it passes the {pct}th percentile.
            {stalled.total > SHOWN && ` Showing the ${SHOWN} largest.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Stuck in</TableHead>
                <TableHead className="text-right">Time in stage</TableHead>
                <TableHead className="text-right">Typical</TableHead>
                <TableHead>Permit expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stalled.rows.map((p) => {
                const expiringSoon = p.expiresDate != null && p.expiresDate >= today && p.daysInStage <= p.slowDays;
                return (
                  <TableRow key={p.projectKey}>
                    <TableCell>
                      <div className="font-medium">{p.address ?? p.mainPermitNum}</div>
                      <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                        <span>{p.craName ?? "Unlocated"}</span>
                        <Link href={projectHref(p.projectKey)} className="hover:underline underline-offset-2">
                          {p.buildingPermits === 1 ? "1 permit" : `${p.buildingPermits} permits`}
                        </Link>
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                            City record <ExternalLink className="size-3" />
                          </a>
                        )}
                        <StreetViewLink lat={p.latitude} lng={p.longitude} />
                      </div>
                    </TableCell>
                    <TableCell>{housingTypeLabel(p.housingType)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.units)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.stage === "applied" ? "Review" : "Construction"}</Badge>
                      <div className="text-muted-foreground mt-1 text-xs">since {formatDate(p.stageStart)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{years(p.daysInStage)}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">{years(p.typicalDays)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(p.expiresDate)}
                      {expiringSoon && (
                        <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-700 dark:text-amber-400">
                          soon
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {stalled.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No stuck projects match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
