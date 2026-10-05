import Link from "next/link";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercentChange } from "@/lib/format";
import { canDerive, type Support } from "@/lib/reliability";

/**
 * A number compared with an earlier window (SPEC X2). The change is only shown when both
 * sides pass the reliability rule (SPEC T2); both sides link to their permits.
 */
export function ComparisonCard({
  title,
  current,
  previous,
  currentHref,
  previousHref,
  previousLabel,
  provisional,
}: {
  title: string;
  current: Support;
  previous: Support;
  currentHref: string;
  previousHref: string;
  previousLabel: string;
  provisional?: string;
}) {
  const cur = current.totalUnits ?? 0;
  const prev = previous.totalUnits ?? 0;
  const change = canDerive(current, previous) ? formatPercentChange(cur, prev) : null;

  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="flex items-baseline gap-3 text-3xl tabular-nums">
          <Link href={currentHref} className="hover:underline underline-offset-4">
            {formatNumber(cur)}
          </Link>
          {change && (
            <span className={change.startsWith("+") ? "text-base text-emerald-600" : "text-base text-rose-600"}>{change}</span>
          )}
        </CardTitle>
        <CardAction>
          <ReliabilityBadge support={current} />
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground flex flex-col gap-1 text-sm">
        {current.removedUnits ? (
          <p className="text-xs tabular-nums">
            {formatNumber(current.addedUnits ?? 0)} added − {formatNumber(current.removedUnits)} demolished
          </p>
        ) : null}
        {!change && <p className="text-xs">Change not shown: too few projects to compare reliably.</p>}
        <Link href={previousHref} className="hover:underline underline-offset-2">
          {formatNumber(prev)} {previousLabel} →
        </Link>
        {provisional && <p className="text-xs">{provisional}</p>}
      </CardContent>
    </Card>
  );
}
