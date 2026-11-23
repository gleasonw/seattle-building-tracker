import Link from "next/link";
import { formatNumber, projectsCount } from "@/lib/format";

export interface RankingRow {
  id: string;
  name: string;
  units: number;
  projects: number;
  /** The place's report. */
  placeHref: string;
  /** The projects behind the number. */
  unitsHref: string;
}

const SHOWN = 10;

/**
 * Neighborhoods ranked by homes completed (SPEC P1 §3). A row's name opens the place's
 * report; its number opens the projects behind it (SPEC T1).
 */
export function Ranking({ rows }: { rows: RankingRow[] }) {
  if (!rows.length) return <p className="text-muted-foreground text-sm">No homes completed yet.</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.units)), 1);
  const row = (r: RankingRow, i: number) => (
    <li key={r.id} className="border-border/60 flex min-h-12 items-center gap-3 border-t">
      <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">{i + 1}</span>
      <Link href={r.placeHref} className="min-w-0 flex-1 truncate text-[15px] font-medium hover:underline">
        {r.name}
      </Link>
      <span aria-hidden className="bg-muted hidden h-2 w-28 overflow-hidden rounded sm:block">
        <span className="bg-primary/80 block h-2" style={{ width: `${(Math.max(r.units, 0) / max) * 100}%` }} />
      </span>
      <Link href={r.unitsHref} className="flex w-20 flex-col items-end text-right hover:underline" title={projectsCount(r.projects)}>
        <span className="text-[15px] font-semibold tabular-nums">{formatNumber(r.units)}</span>
        <span className="text-muted-foreground text-[11px]">{projectsCount(r.projects)}</span>
      </Link>
    </li>
  );
  return (
    <div className="flex flex-col">
      <ol className="flex flex-col">{rows.slice(0, SHOWN).map(row)}</ol>
      {rows.length > SHOWN && (
        <details className="group">
          <summary className="text-primary cursor-pointer list-none py-3 text-sm font-medium hover:underline">
            <span className="group-open:hidden">Show all {rows.length} neighborhoods</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ol className="flex flex-col" start={SHOWN + 1}>
            {rows.slice(SHOWN).map((r, i) => row(r, i + SHOWN))}
          </ol>
        </details>
      )}
    </div>
  );
}
