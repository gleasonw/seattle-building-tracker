import { ExternalLink } from "lucide-react";
import { LongViewChart, type LongViewDatum } from "@/components/charts/long-view-chart";
import { projectsHref, type Where } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import type { Period } from "@/lib/period";
import { MIN_PROJECTS } from "@/lib/reliability";
import type { PolicyEvent } from "@/lib/server/metrics";
import { reportFilters, type YearPoint } from "@/lib/server/report";

/**
 * Homes completed per year with numbered policy markers (SPEC P1 §6), or for a place with its
 * share of the city's completions (SPEC P3 §4). Markers link to primary sources; no causation
 * is claimed.
 */
export function LongView({
  points,
  events,
  where,
  period,
  today,
  showShare,
}: {
  points: YearPoint[];
  events: PolicyEvent[];
  where: Where;
  period: Period;
  today: string;
  showShare: boolean;
}) {
  const f = reportFilters(where, period);
  const currentYear = Number(today.slice(0, 4));
  const markers = new Map<number, number[]>();
  events.forEach((e, i) => {
    const y = Number(e.date.slice(0, 4));
    markers.set(y, [...(markers.get(y) ?? []), i + 1]);
  });
  const data: LongViewDatum[] = points.map((p) => ({
    year: p.year,
    label: `'${String(p.year).slice(2)}`,
    units: p.units,
    share: showShare && p.share !== null && p.shareProjects >= MIN_PROJECTS ? Number((p.share * 100).toFixed(2)) : null,
    href: projectsHref(f.longView(p.year, p.year === currentYear ? today : `${p.year}-12-31`)),
    provisional: p.year === currentYear,
    marker: markers.get(p.year)?.join(", "),
  }));
  return (
    <div className="flex flex-col gap-3">
      <LongViewChart data={data} showShare={showShare} />
      {showShare ? (
        <p className="text-muted-foreground text-xs">
          The outlined bar is {currentYear} so far. The line is this place&apos;s share of all net homes completed in the city that year. It&apos;s hidden for years with fewer than{" "}
          {MIN_PROJECTS} projects here.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">The outlined bar is {currentYear} so far. Click a bar for that year&apos;s projects.</p>
      )}
      {events.length > 0 && (
        <ol className="text-muted-foreground flex flex-col gap-1.5 text-[13px]">
          {events.map((e, i) => (
            <li key={`${e.date}-${e.label}`} className="flex gap-2">
              <span className="bg-muted text-trend-down inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                {i + 1}
              </span>
              <span>
                <span className="text-foreground font-medium">{formatDate(e.date)}:</span> {e.detail ?? e.label}{" "}
                <a href={e.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-0.5 underline underline-offset-2">
                  Source <ExternalLink className="size-3" />
                </a>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
