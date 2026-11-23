import Link from "next/link";
import { FlagBadge, StageBadge } from "@/components/stage-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectHref, type PipelineSort } from "@/lib/filters";
import { formatDate, formatDuration, formatMonthYear, formatNumber, housingTypeLabel } from "@/lib/format";
import type { ProjectList, ProjectRow } from "@/lib/server/projects";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<PipelineSort, string> = { units: "Units", time: "Time in stage", movement: "Last movement" };

export function SortLinks({ sort, hrefFor }: { sort: PipelineSort; hrefFor: (s: PipelineSort) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm" role="group" aria-label="Sort by">
      <span className="text-muted-foreground mr-1">Sort by</span>
      {(Object.keys(SORT_LABELS) as PipelineSort[]).map((s) => (
        <Link
          key={s}
          href={hrefFor(s)}
          scroll={false}
          aria-current={s === sort ? "true" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center rounded-lg border px-3",
            s === sort ? "border-primary bg-accent font-semibold" : "bg-background hover:bg-muted",
          )}
        >
          {SORT_LABELS[s]}
        </Link>
      ))}
    </div>
  );
}

/** Partly built projects say so (SPEC §2 "Stage"). */
export function partlyNote(p: Pick<ProjectRow, "projectUnits" | "completedUnits" | "stage">): string | null {
  if (p.completedUnits > 0 && p.completedUnits < p.projectUnits)
    return `partly complete: ${formatNumber(p.completedUnits)} of ${formatNumber(p.projectUnits)} homes`;
  return null;
}

/** Projects in the pipeline (SPEC P3 §2). Scrolls inside its own box on phones. */
export function PipelineTable({ rows, today }: { rows: ProjectRow[]; today: string }) {
  return (
    <div className="rounded-lg border">
      <Table className="min-w-[520px] sm:min-w-[860px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden sm:table-cell">Stage</TableHead>
            <TableHead>In stage since</TableHead>
            <TableHead>Permit expires</TableHead>
            <TableHead className="hidden sm:table-cell">Flag</TableHead>
            <TableHead>Last movement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const partly = partlyNote(p);
            return (
              <TableRow key={p.projectKey}>
                <TableCell className="max-w-64">
                  <Link href={projectHref(p.mainPermit)} className="text-primary font-semibold hover:underline">
                    {p.address ?? p.mainPermit}
                  </Link>
                  {partly && <div className="text-muted-foreground text-xs">{partly}</div>}
                  {/* On phones, stage and flag sit under the address so "is it stuck?" needs no sideways scroll. */}
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    <StageBadge stage={p.stage} />
                    {p.stage !== "expired" && (p.stalled || p.expiring) && (
                      <FlagBadge stage={p.stage} stalled={p.stalled} expiring={p.expiring} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatNumber(p.units)}</TableCell>
                <TableCell className="text-muted-foreground">{housingTypeLabel(p.housingType)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StageBadge stage={p.stage} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatMonthYear(p.stageSince)} <span className="text-muted-foreground">· {formatDuration(p.stageSince, today)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(p.expiresDate)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <FlagBadge stage={p.stage} stalled={p.stalled} expiring={p.expiring} />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(p.lastMovement)}</TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                No projects in the pipeline here.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const YEAR_ROWS = 10;

/** A past year's projects in a place report (SPEC P3): the largest few, and a link to all of them. */
export function YearProjectsTable({ list, href, empty }: { list: ProjectList; href: string; empty: string }) {
  if (!list.rows.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead>Stage today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.slice(0, YEAR_ROWS).map((p) => (
              <TableRow key={p.projectKey}>
                <TableCell className="max-w-64">
                  <Link href={projectHref(p.mainPermit)} className="text-primary font-semibold hover:underline">
                    {p.address ?? p.mainPermit}
                  </Link>
                  <div className="text-muted-foreground text-xs">{housingTypeLabel(p.housingType)}</div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatNumber(p.added || p.units)}</TableCell>
                <TableCell>
                  <StageBadge stage={p.stage} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Link href={href} className="text-primary text-sm font-medium">
        {list.rows.length > YEAR_ROWS ? `All ${formatNumber(list.rows.length)} projects →` : "As a full list →"}
      </Link>
    </div>
  );
}
