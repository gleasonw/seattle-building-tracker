import type { SearchParams } from "nuqs/server";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hrefWith, pickFilters, type Filters, type UnitKind } from "@/lib/filters";
import { formatDate, formatNumber, housingTypeLabel, STATUS_LABELS } from "@/lib/format";
import { FilteredPermitMap } from "@/components/map/filtered-permit-map";
import { getMapPoints, MAP_POINT_LIMIT } from "@/lib/server/map";
import { listAreas, listPermits, listSubTypes, PAGE_SIZE } from "@/lib/server/permits";
import { dateRange } from "@/lib/server/scope";
import { filtersCache } from "@/lib/server/search-params";

type Sort = "date" | "units" | "permit";

const KIND_DESCRIPTIONS: Record<UnitKind, string> = {
  net: "Building permits that add or remove housing, and demolitions",
  added: "Building permits that add housing",
  removed: "Building permits and demolitions that remove housing",
};

const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : "0");

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
  const [list, map, areas, subTypes] = await Promise.all([
    listPermits(filters, { sort, dir, page }),
    getMapPoints(filters),
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
          {KIND_DESCRIPTIONS[list.kind]}, {on} between {formatDate(from)} and {formatDate(to)}.
          {list.kind !== "added" && " Demolitions are dated by when they were issued."}
        </p>
      </div>

      <FilterBar
        areas={areas}
        subTypes={subTypes}
        showMilestone
        showStatus
      />

      <Card>
        <CardHeader>
          <CardTitle className="tabular-nums">
            {formatNumber(list.kind === "removed" ? list.totalRemoved : list.totalUnits)}{" "}
            {list.kind === "net" ? "net units" : list.kind === "removed" ? "units removed" : "units"} ·{" "}
            {formatNumber(list.totalPermits)} permits · {formatNumber(list.totalProjects)} projects
          </CardTitle>
          {list.kind === "net" && (
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatNumber(list.totalAdded)} added − {formatNumber(list.totalRemoved)} removed
            </p>
          )}
          <CardDescription>
            These totals are computed from exactly the rows below, so they match the number you clicked to get here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FilteredPermitMap points={map.points} className="h-[28rem]" />
          <p className="text-muted-foreground -mt-2 text-xs">
            Circle size shows units; blue adds housing, red removes it. Click the map to count only permits near that point.
            {map.total - map.unlocated > MAP_POINT_LIMIT &&
              ` Showing the ${formatNumber(MAP_POINT_LIMIT)} largest of ${formatNumber(map.total - map.unlocated)} located permits.`}
            {map.unlocated > 0 && ` ${formatNumber(map.unlocated)} permits have no location and aren't on the map.`}
          </p>
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
                    {p.permitType === "Demolition" && <Badge variant="outline" className="mr-1">Demolition</Badge>}
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
                    {formatDate(p.creditedDate)}
                    {p.permitType === "Demolition" && on === "completed" && (
                      <div className="text-muted-foreground text-xs">demolition issued</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {list.kind === "added" ? formatNumber(p.units) : signed(p.units)}
                    {list.kind === "net" && p.added > 0 && p.removed > 0 && (
                      <div className="text-muted-foreground text-xs">
                        +{formatNumber(p.added)} −{formatNumber(p.removed)}
                      </div>
                    )}
                  </TableCell>
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
