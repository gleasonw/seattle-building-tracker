import Link from "next/link";
import { HOUSING_TYPE_LABELS } from "@sbt/data/domain/housing-type";
import { InfoTip } from "@/components/info-tip";
import { HOUSING_TYPE_COLORS } from "@/lib/chart-config";
import { projectsHref, type Filters } from "@/lib/filters";
import { formatNumber } from "@/lib/format";
import type { TypeSlice } from "@/lib/server/report";

/**
 * What got finished, by housing type (SPEC P1 §2): units added by each project's type, as a
 * bar and a legend. Every slice opens its projects. "Other/unknown" is always listed.
 */
export function TypeMix({
  types,
  filters,
  inferredShare,
  unknownShare,
}: {
  types: TypeSlice[];
  /** Filters for units added completed in the period. */
  filters: Filters;
  inferredShare: number;
  unknownShare: number;
}) {
  const total = types.reduce((s, t) => s + t.units, 0);
  return (
    <div className="flex flex-col gap-4">
      {total > 0 ? (
        <div role="img" aria-label="Units completed by housing type" className="flex h-9 gap-0.5 overflow-hidden rounded-md">
          {types
            .filter((t) => t.units > 0)
            .map((t) => (
              <Link
                key={t.type}
                href={projectsHref({ ...filters, type: [t.type] })}
                title={`${HOUSING_TYPE_LABELS[t.type]}: ${formatNumber(t.units)}`}
                className="h-full transition-opacity hover:opacity-80"
                style={{ width: `${(t.units / total) * 100}%`, background: HOUSING_TYPE_COLORS[t.type] }}
              />
            ))}
        </div>
      ) : (
        <div className="bg-muted text-muted-foreground flex h-9 items-center justify-center rounded-md text-sm">No completions yet</div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {types.map((t) => (
          <li key={t.type}>
            <Link href={projectsHref({ ...filters, type: [t.type] })} className="group flex min-h-11 items-start gap-2 py-0.5 text-sm">
              <span aria-hidden className="mt-1 size-3 flex-none rounded-[3px]" style={{ background: HOUSING_TYPE_COLORS[t.type] }} />
              <span className="flex flex-col">
                <span className="font-semibold tabular-nums group-hover:underline">{formatNumber(t.units)}</span>
                <span className="text-muted-foreground">{HOUSING_TYPE_LABELS[t.type]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        {Math.round(inferredShare * 100)}% of these units have a housing type inferred from the permit description; {Math.round(unknownShare * 100)}% couldn&apos;t be classified.
        <InfoTip anchor="housing-type">
          The City records a dwelling type on some permits. Where it doesn&apos;t, the type is inferred from the permit&apos;s category,
          class, unit count and description. A project takes the type of its main permit (the one with the most units).
        </InfoTip>
      </p>
    </div>
  );
}
