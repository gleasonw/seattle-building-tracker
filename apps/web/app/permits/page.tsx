import type { SearchParams } from "nuqs/server";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hrefWith, pickFilters, type Filters } from "@/lib/filters";
import { formatDate, formatNumber, housingTypeLabel, STATUS_LABELS } from "@/lib/format";
import { listAreas, listPermits, listSubTypes, PAGE_SIZE } from "@/lib/server/permits";
import { dateRange } from "@/lib/server/scope";
import { filtersCache } from "@/lib/server/search-params";

type Sort = "date" | "units" | "permit";

function SortIcon({ field, sort, dir }: { field: Sort; sort: Sort; dir: "asc" | "desc" }) {
  if (sort !== field) return null;
  return dir === "desc" ? <ArrowDown className="inline size-3" /> : <ArrowUp className="inline size-3" />;
}

/** X3: the exact permits behind any number. Totals here equal the number that was clicked. */
export default async function PermitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const parsed = await filtersCache.parse(searchParams);
  const { sort, dir, page } = parsed;
  const filters = pickFilters(parsed);
  const on = filters.on ?? "completed";
  const [list, areas, subTypes] = await Promise.all([
    listPermits(filters, { sort, dir, page }),
    listAreas(),
    listSubTypes(),
  ]);
  const { from, to } = dateRange(filters);
  const pages = Math.max(1, Math.ceil(list.totalPermits / PAGE_SIZE));

  const link = (patch: Partial<Filters & { sort: Sort; dir: "asc" | "desc"; page: number }>) =>
    hrefWith("/permits", { ...filters, sort, dir, page, ...patch });
  const sortLink = (field: Sort) =>
    link({ sort: field, dir: sort === field && dir === "desc" ? "asc" : "desc", page: 1 });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Permits</h1>
        <p className="text-muted-foreground text-sm">
          Building permits that add housing, {on} between {formatDate(from)} and {formatDate(to)}.
        </p>
      </div>

      <FilterBar
        areas={areas.map((a) => ({ value: a.id, label: a.name }))}
        subTypes={subTypes}
        showMilestone
        showStatus
      />

      <Card>
        <CardHeader>
          <CardTitle className="tabular-nums">
            {formatNumber(list.totalUnits)} units · {formatNumber(list.totalPermits)} permits ·{" "}
            {formatNumber(list.totalProjects)} projects
          </CardTitle>
          <CardDescription>
            These totals are computed from exactly the rows below, so they match the number you clicked to get here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Link href={sortLink("permit")}>Permit <SortIcon field="permit" sort={sort} dir={dir} /></Link>
                </TableHead>
                <TableHead>Address / area</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>
                  <Link href={sortLink("date")} className="capitalize">{on} <SortIcon field="date" sort={sort} dir={dir} /></Link>
                </TableHead>
                <TableHead className="text-right">
                  <Link href={sortLink("units")}>Units <SortIcon field="units" sort={sort} dir={dir} /></Link>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((p) => (
                <TableRow key={p.permitNum}>
                  <TableCell className="font-mono text-xs">
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        {p.permitNum} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      p.permitNum
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.address ?? "—"}</div>
                    <div className="text-muted-foreground text-xs">{p.craName ?? "Unlocated"}</div>
                  </TableCell>
                  <TableCell>
                    {housingTypeLabel(p.housingType)}
                    {p.housingTypeSource === "inferred" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground ml-1 cursor-help text-xs">*</span>
                        </TooltipTrigger>
                        <TooltipContent>Inferred from the permit description; the City didn&apos;t record a type.</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.statusCategory === "done" ? "secondary" : "outline"}>
                      {STATUS_LABELS[p.statusCategory] ?? p.statusCategory}
                    </Badge>
                    <div className="text-muted-foreground mt-1 text-xs">{p.statusCurrent}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(p.appliedDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(p.issuedDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(on === "applied" ? p.appliedDate : on === "issued" ? p.issuedDate : p.completedDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.units)}</TableCell>
                </TableRow>
              ))}
              {list.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    No permits match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {formatNumber(pages)}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                <Link href={link({ page: Math.max(1, page - 1) })} aria-disabled={page <= 1}>Previous</Link>
              </Button>
              <Button variant="outline" size="sm" asChild disabled={page >= pages}>
                <Link href={link({ page: Math.min(pages, page + 1) })} aria-disabled={page >= pages}>Next</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
