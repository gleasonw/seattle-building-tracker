import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Movement, MovementKind } from "@/lib/server/movement";
import type { ProjectRow } from "@/lib/server/projects";
import { projectHref } from "@/lib/filters";
import { formatDayMonth, formatNumber, unitsNoun } from "@/lib/format";
import { canDerive, type Support } from "@/lib/reliability";
import { InfoTip } from "@/components/info-tip";
import { cn } from "@/lib/utils";

const KIND_STYLES: Record<MovementKind | "completedChip" | "issuedChip", string> = {
  applied: "bg-muted text-foreground",
  issued: "bg-stage-review/25 text-stage-stalled dark:text-stage-review",
  completed: "bg-primary/10 text-primary",
  expired: "bg-stage-stalled text-white dark:text-background",
  died: "bg-muted text-muted-foreground",
  completedChip: "bg-primary/10 text-primary",
  issuedChip: "bg-stage-review/25 text-stage-stalled dark:text-stage-review",
};

const KIND_LABELS: Record<MovementKind, string> = {
  applied: "Applied",
  issued: "Issued",
  completed: "Completed",
  expired: "Permit expired",
  died: "Died",
};

export function KindChip({ kind, className }: { kind: keyof typeof KIND_STYLES; className?: string }) {
  const label = kind === "completedChip" ? "Completed" : kind === "issuedChip" ? "Issued" : KIND_LABELS[kind];
  return <Badge className={cn("w-[7.5rem] justify-center rounded-full font-semibold", KIND_STYLES[kind], className)}>{label}</Badge>;
}

/** Biggest projects of the year with their share of the year's total (SPEC P1 §4). */
export function BiggestProjects({
  completed,
  issued,
  completedTotal,
  issuedTotal,
}: {
  completed: ProjectRow[];
  issued: ProjectRow[];
  completedTotal: Support;
  issuedTotal: Support;
}) {
  const items = [
    ...completed.map((p) => ({ p, kind: "completedChip" as const, total: completedTotal, what: "completed" })),
    ...issued.map((p) => ({ p, kind: "issuedChip" as const, total: issuedTotal, what: "issued" })),
  ];
  if (!items.length) return <p className="text-muted-foreground text-sm">Nothing completed or issued yet.</p>;
  return (
    <ul className="flex flex-col">
      {items.map(({ p, kind, total, what }) => {
        const share = canDerive(total) && total.totalUnits ? p.added / total.totalUnits : null;
        return (
          <li key={`${kind}-${p.projectKey}`} className="border-border/60 border-t">
            <Link href={projectHref(p.mainPermit)} className="group flex min-h-13 flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <KindChip kind={kind} className="w-20" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-medium break-words group-hover:underline">{p.address ?? p.mainPermit}</span>
                <span className="text-muted-foreground text-[13px]">{p.hoodName ?? "Unlocated"}</span>
              </span>
              <span className="flex flex-col text-right">
                <span className="text-[15px] font-semibold tabular-nums">{formatNumber(p.added)}</span>
                <span className="text-muted-foreground text-xs">
                  {share !== null ? `${share < 0.01 ? "<1" : Math.round(share * 100)}% of ${what}` : `of ${formatNumber(total.totalUnits ?? 0)} ${what}`}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A dated feed of movement, newest first (SPEC §2 "Movement", P1 §5, P3 §3). */
export function MovementFeed({ moves, showPlace = true, empty }: { moves: Movement[]; showPlace?: boolean; empty: string }) {
  if (!moves.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {moves.map((m) => (
        <li
          key={`${m.projectKey}-${m.kind}-${m.date}`}
          className="border-border/60 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-t py-2"
        >
          <span className="text-muted-foreground flex w-16 flex-col text-[13px] tabular-nums">
            {formatDayMonth(m.date)}
            {m.dating !== "city" && (
              <span className="flex items-center text-[11px]">
                {m.dating === "noticed" ? "noticed" : "approx."}
                <InfoTip anchor="movement" label="How this is dated" className="size-4">
                  {m.dating === "noticed"
                    ? "The City publishes no date for this change, so it's dated by when this app first noticed it in the City's data."
                    : "The City publishes no date for this change and it happened before this app began recording, so it's dated by the permit's last milestone."}
                </InfoTip>
              </span>
            )}
          </span>
          <KindChip kind={m.kind} />
          <Link href={projectHref(m.mainPermit)} className="min-w-44 flex-1 text-[15px] font-medium hover:underline">
            {m.address ?? m.mainPermit}
            {showPlace && m.hoodName && <span className="text-muted-foreground font-normal"> · {m.hoodName}</span>}
          </Link>
          <span className="text-muted-foreground text-sm tabular-nums">
            {m.projectUnits > m.units
              ? `${formatNumber(m.units)} of ${formatNumber(m.projectUnits)} homes`
              : unitsNoun(m.units, m.housingType)}
          </span>
        </li>
      ))}
    </ul>
  );
}
