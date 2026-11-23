import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BiggestProjects } from "@/components/project-list-items";
import { InfoTip } from "@/components/info-tip";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { TypeMix } from "@/components/type-mix";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { projectsHref, type Outcome, type Where } from "@/lib/filters";
import { formatNumber, homes, projectsCount, unitsCount } from "@/lib/format";
import type { Period } from "@/lib/period";
import { canDerive, concentrationNote } from "@/lib/reliability";
import { STALLED_ISSUED_YEARS, STALLED_REVIEW_YEARS } from "@/lib/rules";
import { reportFilters, type YearReport } from "@/lib/server/report";
import { cn } from "@/lib/utils";

export const COMPLETED_INFO = (
  <>
    Net homes: units added by building permits that reached <em>completed</em> (roughly final inspection or occupancy) in the period,
    minus units removed by demolitions in the same period. Completion can lag move-in by weeks to months.
  </>
);
const PROVISIONAL_INFO = "Completions are sometimes recorded late, so these figures can still rise.";

/** Year navigation: step back to any earlier year, or forward to this year (SPEC P1 "Past years"). */
export function YearStepper({
  period,
  currentYear,
  hrefFor,
}: {
  period: Period;
  currentYear: number;
  hrefFor: (year: number) => string;
}) {
  const button = "bg-card hover:bg-muted inline-flex size-11 items-center justify-center rounded-lg border";
  return (
    <div className="flex items-center gap-2">
      <Link href={hrefFor(period.year - 1)} aria-label={`Previous year: ${period.year - 1}`} className={button}>
        <ChevronLeft className="size-5" />
      </Link>
      {period.year < currentYear && (
        <Link href={hrefFor(period.year + 1)} aria-label={`Next year: ${period.year + 1}`} className={button}>
          <ChevronRight className="size-5" />
        </Link>
      )}
      <span className="text-muted-foreground flex items-center text-[13px] font-semibold tracking-wide uppercase">
        {period.label}
        {period.provisional && (
          <>
            {!period.ytd && <span className="ml-1.5 normal-case">· provisional</span>}
            <InfoTip anchor="provisional" label="Why provisional">
              {period.ytd ? "This year so far is compared with the same dates last year. " : ""}
              {PROVISIONAL_INFO}
            </InfoTip>
          </>
        )}
      </span>
    </div>
  );
}

/** January's default: last year in review, with an obvious switch to the new year (SPEC §2 "This year"). */
export function EarlyYearNotice({ currentYear, href }: { currentYear: number; href: string }) {
  return (
    <Alert>
      <AlertDescription>
        It&apos;s early in {currentYear}, so this shows {currentYear - 1} in review (provisional: completions are still being
        recorded).{" "}
        <Link href={href} className="text-primary font-medium underline underline-offset-2">
          See {currentYear} so far
        </Link>
      </AlertDescription>
    </Alert>
  );
}

/** The headline numbers (SPEC P1 §1, P3 §1). */
export function Headline({
  report,
  where,
  period,
  cityPipelineUnits,
}: {
  report: YearReport;
  where: Where;
  period: Period;
  /** For a place: the city's pipeline, for the place's share of it. */
  cityPipelineUnits?: number;
}) {
  const f = reportFilters(where, period);
  const { completed, issued, applied, pipeline } = report;
  const previousLabel = period.ytd ? "last year" : `in ${period.year - 1}`;
  const share =
    pipeline && cityPipelineUnits && canDerive(pipeline.total)
      ? `${((100 * (pipeline.total.totalUnits ?? 0)) / cityPipelineUnits).toFixed(1)}% of the city's pipeline`
      : null;
  return (
    <section aria-label="Headline numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Homes completed"
        info={
          <>
            {COMPLETED_INFO} {period.provisional && PROVISIONAL_INFO}
          </>
        }
        infoAnchor="counting"
        support={completed.current}
        href={projectsHref(f.completed)}
        previous={completed.previous}
        previousHref={projectsHref(f.completedPrev)}
        previousLabel={previousLabel}
        notes={[
          <Link key="r" href={projectsHref(f.removed)} className="hover:underline">
            {formatNumber(completed.current.removedUnits ?? 0)} demolished
          </Link>,
          period.provisional ? "provisional" : null,
        ]}
      />
      <StatCard
        label="Homes permitted"
        info="Units on building permits issued in the period: a sign that construction is about to start."
        infoAnchor="counting"
        support={issued.current}
        href={projectsHref(f.issued)}
        previous={issued.previous}
        previousHref={projectsHref(f.issuedPrev)}
        previousLabel={previousLabel}
        notes={[period.ytd ? "construction about to start" : null]}
      />
      <StatCard
        label="Homes applied for"
        info="Units on building permits applied for in the period: new projects entering the pipeline."
        infoAnchor="counting"
        support={applied.current}
        href={projectsHref(f.applied)}
        previous={applied.previous}
        previousHref={projectsHref(f.appliedPrev)}
        previousLabel={previousLabel}
        notes={[period.ytd ? "new projects entering the pipeline" : null]}
      />
      {pipeline ? (
        <StatCard
          label="In the pipeline today"
          info={
            <>
              Units in projects that are in review or issued today, counted on their permits that aren&apos;t completed yet.
              Stalled: in review {STALLED_REVIEW_YEARS}+ years, or issued {STALLED_ISSUED_YEARS}+ years ago and not completed.
            </>
          }
          infoAnchor="stages"
          support={pipeline.total}
          href={projectsHref(f.pipeline)}
          detail={
            <span className="text-muted-foreground text-sm font-semibold">
              <Link href={projectsHref(f.review)} className="hover:underline">
                {formatNumber(pipeline.review.totalUnits ?? 0)} in review
              </Link>{" "}
              ·{" "}
              <Link href={projectsHref(f.issuedPipeline)} className="hover:underline">
                {formatNumber(pipeline.issued.totalUnits ?? 0)} issued
              </Link>
            </span>
          }
          notes={[
            <Link key="s" href={projectsHref(f.stalled)} className="hover:underline">
              {unitsCount(pipeline.stalled.totalUnits ?? 0)} stalled
            </Link>,
            share,
          ]}
        />
      ) : (
        <OutcomesCard report={report} where={where} period={period} />
      )}
    </section>
  );
}

const OUTCOME_LABELS: Record<Outcome, string> = {
  completed: "since completed",
  progress: "still in progress",
  expired: "permit expired",
  dead: "died",
};

/** What happened to a past year's applications (SPEC P1 "Past years"). */
function OutcomesCard({ report, where, period }: { report: YearReport; where: Where; period: Period }) {
  const f = reportFilters(where, period);
  const outcomes = report.outcomes!;
  const total = report.applied.current.totalUnits ?? 0;
  return (
    <Card className="gap-2 px-5 py-5">
      <div className="text-muted-foreground flex items-center gap-1 text-sm font-semibold">
        What happened to {period.year}&apos;s applications
        <InfoTip anchor="stages">
          The {unitsCount(total)} applied for in {period.year}, by where each permit stands today. A permit expired after it was
          issued with no completion recorded; it died if it was cancelled, denied, withdrawn or expired before being issued.
        </InfoTip>
      </div>
      <ul className="flex flex-col gap-1">
        {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
          <li key={o} className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-sm">{OUTCOME_LABELS[o]}</span>
            <Link href={projectsHref(f.outcome(o))} className="text-lg font-bold tabular-nums hover:underline">
              {formatNumber(outcomes[o].totalUnits ?? 0)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-[13px]">units · {projectsCount(report.applied.current.projectCount)} applied</p>
    </Card>
  );
}

/** "What got finished" (SPEC P1 §2). */
export function WhatGotFinished({ report, where, period }: { report: YearReport; where: Where; period: Period }) {
  const f = reportFilters(where, period);
  const c = report.completed.current;
  return (
    <Section
      title={`What got finished: ${homes(c.addedUnits ?? 0)} added, by housing type`}
      aside={`${formatNumber(c.removedUnits ?? 0)} demolished · ${homes(c.totalUnits ?? 0)} net · ${projectsCount(c.projectCount)}`}
    >
      <TypeMix
        types={report.types}
        filters={f.added}
        inferredShare={report.typeShares.inferredShare}
        unknownShare={report.typeShares.unknownShare}
      />
    </Section>
  );
}

export function Biggest({ report, period, className }: { report: YearReport; period: Period; className?: string }) {
  const concentrated = concentrationNote(report.issued.current);
  return (
    <Section
      className={cn("flex-1 basis-[360px]", className)}
      title={period.ytd ? "Biggest projects this year" : `Biggest projects of ${period.year}`}
      description={`Largest completions and issuances, with their share of the year's total.${concentrated ? ` ${concentrated} issued.` : ""}`}
    >
      <BiggestProjects
        completed={report.biggestCompleted}
        issued={report.biggestIssued}
        completedTotal={{ ...report.completed.current, totalUnits: report.completed.current.addedUnits }}
        issuedTotal={report.issued.current}
      />
    </Section>
  );
}
