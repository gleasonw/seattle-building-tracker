import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { Card } from "@/components/ui/card";
import { formatNumber, percentChange, projectsCount } from "@/lib/format";
import { canDerive, concentrationNote, type Support } from "@/lib/reliability";
import { cn } from "@/lib/utils";

/**
 * A headline number (SPEC P1 §1). The number opens its project list; the comparison opens
 * last year's. The percent change is hidden when either side has too few projects (SPEC T2).
 */
export function StatCard({
  label,
  info,
  infoAnchor,
  support,
  href,
  previous,
  previousHref,
  previousLabel = "last year",
  notes = [],
  detail,
}: {
  label: string;
  info: React.ReactNode;
  infoAnchor: string;
  support: Support;
  href: string;
  previous?: Support;
  previousHref?: string;
  previousLabel?: string;
  notes?: React.ReactNode[];
  /** Replaces the comparison line (e.g. the pipeline's split). */
  detail?: React.ReactNode;
}) {
  const value = support.totalUnits ?? 0;
  const concentrated = concentrationNote(support);
  return (
    <Card className="gap-1.5 px-5 py-5">
      <div className="text-muted-foreground flex items-center gap-1 text-sm font-semibold">
        {label}
        <InfoTip anchor={infoAnchor}>{info}</InfoTip>
      </div>
      <Link href={href} className="w-fit text-4xl font-bold tracking-tight tabular-nums hover:underline hover:underline-offset-4">
        {formatNumber(value)}
      </Link>
      {detail ?? (previous && previousHref && <Delta current={support} previous={previous} href={previousHref} label={previousLabel} />)}
      <p className="text-muted-foreground text-[13px] leading-snug">
        {[projectsCount(support.projectCount), concentrated, ...notes].filter(Boolean).map((n, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {n}
          </span>
        ))}
      </p>
    </Card>
  );
}

function Delta({ current, previous, href, label }: { current: Support; previous: Support; href: string; label: string }) {
  const cur = current.totalUnits ?? 0;
  const prev = previous.totalUnits ?? 0;
  const change = percentChange(cur, prev);
  const showPct = change !== null && canDerive(current, previous);
  const same = showPct ? Math.abs(change!) < 0.05 : cur === prev;
  const up = cur > prev;
  const prevLink = (
    <Link href={href} className="hover:underline hover:underline-offset-2">
      {formatNumber(prev)} {label}
    </Link>
  );
  if (same)
    return <span className="text-muted-foreground text-sm font-semibold">about the same as {label} ({prevLink})</span>;
  return (
    <span className={cn("text-sm font-semibold", up ? "text-trend-up" : "text-trend-down")}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "Up" : "Down"}</span> {showPct && `${Math.abs(Math.round(change! * 100))}% `}vs {prevLink}
    </span>
  );
}
