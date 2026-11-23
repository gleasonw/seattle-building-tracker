import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Download } from "lucide-react";
import Link from "next/link";
import { partlyNote } from "@/components/pipeline-table";
import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notFound } from "next/navigation";
import { isIsoDate, pickFilters, projectHref, projectsHref } from "@/lib/filters";
import { formatNumber, housingTypeLabel, projectsCount, signed } from "@/lib/format";
import { describe } from "@/lib/server/describe";
import { listProjects, PAGE_SIZE } from "@/lib/server/projects";
import { unitKind } from "@/lib/server/scope";
import { filtersCache } from "@/lib/server/search-params";
import { getToday } from "@/lib/server/today";

export const metadata: Metadata = { title: "Projects behind a number" };

/** T1: the exact projects behind any number. The total here equals the number that was clicked. */
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  // A list whose dates can't be read would silently show all time under the same link.
  for (const key of ["from", "to"] as const) {
    const v = raw[key];
    if (v !== undefined && !(typeof v === "string" && isIsoDate(v))) notFound();
  }
  const parsed = await filtersCache.parse(raw);
  const { sort, page } = parsed;
  const filters = pickFilters(parsed);
  const today = await getToday(parsed.asof);
  const [list, description] = await Promise.all([listProjects(filters, today, { sort, page }), describe(filters, today)]);
  const pages = Math.max(1, Math.ceil(list.totalProjects / PAGE_SIZE));
  const kind = unitKind(filters);
  const completedList = (filters.m ?? "completed") === "completed";
  const total = kind === "removed" ? list.totalRemoved : list.totalUnits;
  const csv = projectsHref(filters).replace("/projects", "/projects/csv");

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight tabular-nums">
          {formatNumber(total)} {kind === "removed" ? "units removed" : kind === "net" ? "net homes" : "units"} ·{" "}
          {projectsCount(list.totalProjects)}
        </h1>
        <p className="text-muted-foreground max-w-3xl">{description}</p>
        {kind === "net" && (
          <p className="text-muted-foreground text-sm tabular-nums">
            {formatNumber(list.totalAdded)} added − {formatNumber(list.totalRemoved)} removed, on {formatNumber(list.totalPermits)} permits.
          </p>
        )}
      </div>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>The total above is the sum of exactly these rows, so it matches the number you clicked.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={projectsHref(filters, { sort: sort === "units" ? "address" : "units" })}>
                Sort by {sort === "units" ? "address" : "units"}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={csv}>
                <Download /> CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Neighborhood</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Permits</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((p) => {
                  const partly = partlyNote(p);
                  return (
                    <TableRow key={p.projectKey}>
                      <TableCell className="max-w-72">
                        <Link href={projectHref(p.mainPermit)} className="text-primary font-semibold hover:underline">
                          {p.address ?? p.mainPermit}
                        </Link>
                        {partly && <div className="text-muted-foreground text-xs">{partly}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.hoodName ?? "Unlocated"}</TableCell>
                      <TableCell className="text-muted-foreground">{housingTypeLabel(p.housingType)}</TableCell>
                      <TableCell>
                        {/* Under a completion total, every row is completed work, whatever stage the project's main permit is at. */}
                        {completedList && p.added === 0 ? (
                          <Badge variant="outline" className="rounded-full">
                            Units removed
                          </Badge>
                        ) : (
                          <StageBadge stage={completedList ? "completed" : p.stage} />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.permits}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {kind === "net" ? signed(p.units) : formatNumber(kind === "removed" ? p.removed : p.units)}
                        {kind === "net" && p.added > 0 && p.removed > 0 && (
                          <div className="text-muted-foreground text-xs font-normal">
                            +{formatNumber(p.added)} −{formatNumber(p.removed)}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {list.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No projects.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {formatNumber(pages)}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={projectsHref(filters, { sort, page: page - 1 })}>Previous</Link>
                  </Button>
                )}
                {page < pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={projectsHref(filters, { sort, page: page + 1 })}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
