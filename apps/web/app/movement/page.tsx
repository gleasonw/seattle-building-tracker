import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "nuqs/server";
import { MovementFeed } from "@/components/project-list-items";
import { Section } from "@/components/section";
import { MOVEMENT_PERIOD_LABELS, MOVEMENT_PERIODS, type MovementPeriod } from "@/lib/rules";
import { getMovement } from "@/lib/server/movement";
import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";
import { parseAsIsoDate } from "@/lib/filters";
import { getToday } from "@/lib/server/today";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Movement citywide" };

const LIMIT = 500;
const PERIODS = Object.keys(MOVEMENT_PERIODS) as MovementPeriod[];
const cache = createSearchParamsCache({
  moves: parseAsStringLiteral(PERIODS).withDefault("30d"),
  asof: parseAsIsoDate,
});

/** Every movement citywide (SPEC P1 §5 "with a link to all of them"). */
export default async function MovementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { moves: period, asof } = await cache.parse(searchParams);
  const today = await getToday(asof);
  const all = await getMovement({}, today, { days: MOVEMENT_PERIODS[period], limit: LIMIT + 1 });
  const moves = all.slice(0, LIMIT);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-primary text-sm">
          ← This year
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Movement citywide</h1>
        <p className="text-muted-foreground max-w-2xl">
          Every project that applied, was issued, completed, had its permit expire or died, newest first. Dates are the City&apos;s; where
          the City gives none, the date is when this app first noticed the change.
        </p>
      </div>
      <Section
        title={`${all.length > LIMIT ? `The newest ${LIMIT}` : moves.length.toLocaleString()} movements in the last ${MOVEMENT_PERIOD_LABELS[period]}`}
        aside={
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/movement?moves=${p}`}
                aria-current={p === period}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-lg border px-2.5 text-[13px]",
                  p === period ? "border-primary bg-accent font-semibold" : "bg-card hover:bg-muted",
                )}
              >
                {MOVEMENT_PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
        }
      >
        <MovementFeed moves={moves} empty="Nothing moved in this period." />
      </Section>
    </>
  );
}
