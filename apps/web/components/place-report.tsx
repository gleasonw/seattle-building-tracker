import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { LongView } from "@/components/long-view";
import { LazyPlaceMap } from "@/components/map/lazy-place-map";
import type { MapProject } from "@/components/map/place-map";
import { PipelineTable, SortLinks, YearProjectsTable } from "@/components/pipeline-table";
import { MovementFeed } from "@/components/project-list-items";
import { Section } from "@/components/section";
import { SubscribeForm, type SubscriptionMessage } from "@/components/subscribe-form";
import { EarlyYearNotice, Headline, WhatGotFinished, YearStepper } from "@/components/year-report";
import { placeHref, projectHref, projectsHref, type PipelineSort, type Where } from "@/lib/filters";
import { homes, projectsCount, unitsCount } from "@/lib/format";
import { periodFor, resolveYear } from "@/lib/period";
import {
  DEFAULT_RADIUS_MILES,
  EXPIRING_SOON_MONTHS,
  MOVEMENT_PERIOD_LABELS,
  MOVEMENT_PERIODS,
  PIPELINE_TABLE_ROWS,
  radiusLabel,
  SHOW_PROPOSALS,
  STALLED_ISSUED_YEARS,
  STALLED_REVIEW_YEARS,
  type MovementPeriod,
} from "@/lib/rules";
import { placeSummary } from "@/lib/summary";
import { getPolicyEvents, summarize } from "@/lib/server/metrics";
import { getMovement } from "@/lib/server/movement";
import { notificationsConfigured } from "@/lib/server/notifications";
import type { RelatedPlace } from "@/lib/server/places";
import { listProjects, type ProjectRow } from "@/lib/server/projects";
import { getYearReport, reportFilters } from "@/lib/server/report";
import { cn } from "@/lib/utils";

export interface ReportPlace {
  /** e.g. "Roosevelt" or "½ mile around 6716 Roosevelt Way NE". */
  name: string;
  /** e.g. "Neighborhood" or "Within a radius". */
  kindLabel: string;
  where: Where;
  polygons?: [number, number][][][];
  circle?: { lat: number; lng: number; miles: number };
  /** A point inside the place, for a radius report around it. */
  center: { lat: number; lng: number };
  /** Label for a radius around this place. */
  radiusLabel: string;
  related: RelatedPlace[];
  /** Link to the same report with other settings (T7). */
  hrefWith: (settings: {
    year?: number | null;
    sort?: PipelineSort;
    moves?: MovementPeriod;
    all?: boolean;
    asof?: string | null;
  }) => string;
  /** For radius reports: links to other radii. */
  radii?: { miles: number; href: string }[];
}

export interface ReportSettings {
  year: number | null;
  sort: PipelineSort;
  moves: MovementPeriod;
  all: boolean;
  /** Development only (lib/server/today.ts); carried through links. */
  asof?: string | null;
  /** Outcome of an email-updates action, shown by the signup form. */
  subscription?: SubscriptionMessage | null;
}

const chip =
  "bg-card hover:bg-muted inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors aria-[current=true]:border-primary aria-[current=true]:bg-accent aria-[current=true]:font-semibold";

/** P3: how is housing going in this place? */
export async function PlaceReport({ place, settings, today }: { place: ReportPlace; settings: ReportSettings; today: string }) {
  const currentYear = Number(today.slice(0, 4));
  const resolved = resolveYear(settings.year, today);
  const period = periodFor(resolved.year, today);
  const { where } = place;
  const f = reportFilters(where, period);

  const [report, pipelineRows, mapRows, proposals, moves, cityPipeline, expiredStillIssued, events] = await Promise.all([
    getYearReport(where, period, today),
    period.ytd ? listProjects(f.pipelineTable, today, { sort: settings.sort, limit: settings.all ? null : PIPELINE_TABLE_ROWS }) : null,
    period.ytd ? listProjects(f.pipeline, today, { limit: null }) : null,
    period.ytd && SHOW_PROPOSALS ? summarize(f.proposals, today) : null,
    period.ytd ? getMovement(where, today, { days: MOVEMENT_PERIODS[settings.moves] }) : null,
    period.ytd ? summarize({ m: "pipeline" }, today) : null,
    period.ytd ? summarize(f.expiredStillIssued, today) : null,
    getPolicyEvents(),
  ]);
  // A past year has no pipeline today: its own projects are listed and mapped instead (SPEC P3).
  const [yearCompleted, yearApplied] = period.ytd
    ? [null, null]
    : await Promise.all([listProjects(f.added, today, { limit: null }), listProjects(f.appliedAll, today, { limit: null })]);
  const largest = mapRows ? mapRows.rows.slice(0, 10) : [];
  const summary = placeSummary(report, period, largest);
  const toMap = (rows: ProjectRow[], kind: (r: ProjectRow) => MapProject["kind"] | null, stalled: boolean): MapProject[] =>
    rows.flatMap((r) => {
      const k = kind(r);
      if (r.lat == null || r.lng == null || !k) return [];
      return [
        {
          key: `${k}-${r.projectKey}`,
          lat: r.lat,
          lng: r.lng,
          units: r.added || r.units,
          kind: k,
          stalled: stalled && r.stalled,
          address: r.address ?? r.mainPermit,
          href: projectHref(r.mainPermit),
        },
      ];
    });
  const mapProjects: MapProject[] = period.ytd
    ? toMap(mapRows?.rows ?? [], (r) => (r.stage === "review" || r.stage === "issued" ? r.stage : null), true)
    : [
        ...toMap(yearApplied?.rows ?? [], () => "applied", false),
        ...toMap(yearCompleted?.rows ?? [], () => "completed", false),
      ];
  // Every year link names its year, so the current year stays reachable in January.
  const yearHref = (y: number) => place.hrefWith({ year: y, asof: settings.asof });

  return (
    <>
      {resolved.earlyInYear && <EarlyYearNotice currentYear={currentYear} href={yearHref(currentYear)} />}
      <div className="flex flex-wrap items-stretch gap-6">
        <section className="flex min-w-0 flex-[1_1_520px] flex-col gap-3.5">
          <Link href="/search" className="text-primary text-sm">
            ← Places
          </Link>
          <YearStepper period={period} currentYear={currentYear} hrefFor={yearHref} />
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-[13px] font-semibold tracking-wide uppercase">
              {place.kindLabel} · {period.ytd ? `${period.year} to date` : period.year}
            </span>
            <h1 className="text-4xl leading-tight font-bold tracking-tight break-words sm:text-5xl">{place.name}</h1>
          </div>
          <p className="max-w-2xl text-[17px] leading-relaxed">{summary}</p>
          <div className="flex flex-wrap gap-2">
            {place.related.slice(0, 3).map((r) => (
              <Link key={r.id} href={placeHref(r, { year: settings.year, asof: settings.asof })} className={chip}>
                Switch to {r.name}
              </Link>
            ))}
            {place.radii
              ? place.radii.map((r) => (
                  <Link key={r.miles} href={r.href} aria-current={place.circle?.miles === r.miles} className={chip}>
                    {radiusLabel(r.miles)}
                  </Link>
                ))
              : (
                  <Link
                    href={placeHref({ ...place.center, r: DEFAULT_RADIUS_MILES, label: place.radiusLabel }, { year: settings.year, asof: settings.asof })}
                    className={chip}
                  >
                    {radiusLabel(DEFAULT_RADIUS_MILES)} around its center
                  </Link>
                )}
          </div>
        </section>

        <section aria-label={`Map of ${place.name}`} className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
          <div className="isolate h-80 overflow-hidden rounded-xl border sm:h-[22rem]">
            <LazyPlaceMap className="h-full w-full" polygons={place.polygons} circle={place.circle} projects={mapProjects} />
          </div>
          {period.ytd ? (
            <div className="text-muted-foreground flex flex-wrap gap-4 text-[13px]">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="bg-stage-issued size-3 rounded-full" />
                Issued
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="bg-stage-review size-3 rounded-full" />
                In review
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="border-stage-stalled size-3 rounded-full border-2" />
                Stalled
              </span>
              <span>Size = units · pipeline projects today</span>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-wrap gap-4 text-[13px]">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="bg-stage-issued size-3 rounded-full" />
                Completed in {period.year}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="bg-stage-review size-3 rounded-full" />
                Applied for in {period.year}
              </span>
              <span>Size = units</span>
            </div>
          )}
        </section>
      </div>

      <Headline report={report} where={where} period={period} cityPipelineUnits={cityPipeline?.totalUnits ?? undefined} />

      {pipelineRows && (
        <Section
          id="pipeline"
          title="Projects in the pipeline"
          aside={<SortLinks sort={settings.sort} hrefFor={(sort) => `${place.hrefWith({ year: settings.year, asof: settings.asof, sort, moves: settings.moves, all: settings.all })}#pipeline`} />}
        >
          <PipelineTable rows={pipelineRows.rows} today={today} />
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {pipelineRows.totalProjects > pipelineRows.rows.length ? (
              <>
                Showing the {pipelineRows.rows.length} {settings.sort === "units" ? "largest" : "first"} of{" "}
                {projectsCount(pipelineRows.totalProjects)}.{" "}
                <Link
                  href={`${place.hrefWith({ year: settings.year, asof: settings.asof, sort: settings.sort, moves: settings.moves, all: true })}#pipeline`}
                  scroll={false}
                  className="text-primary underline underline-offset-2"
                >
                  Show all
                </Link>
              </>
            ) : (
              <>
                {projectsCount(pipelineRows.totalProjects)}, {homes(pipelineRows.totalUnits)}.
              </>
            )}{" "}
            {expiredStillIssued && expiredStillIssued.projectCount > 0 && (
              <>
                The table includes{" "}
                <Link href={projectsHref(f.expiredStillIssued)} className="text-primary underline underline-offset-2">
                  {projectsCount(expiredStillIssued.projectCount)}
                </Link>{" "}
                whose permit has expired though the City still lists {expiredStillIssued.projectCount === 1 ? "it" : "them"} as issued; they
                aren&apos;t counted in the pipeline.{" "}
              </>
            )}
            “Stalled” means in review {STALLED_REVIEW_YEARS}+ years, or issued {STALLED_ISSUED_YEARS}+ years ago and not completed;
            “expiring soon”, a permit that expires within {EXPIRING_SOON_MONTHS} months.
            <InfoTip anchor="stalled">
              A permit counts as expired once its expiration date passes with no completion, even if the City still lists it as issued. That
              can mean the project stalled, finished without a recorded final inspection, or moved to another permit; the data can&apos;t tell
              which.
            </InfoTip>
            {proposals && proposals.projectCount > 0 && (
              <span>
                Another {projectsCount(proposals.projectCount)} ({unitsCount(proposals.totalUnits ?? 0)}) are proposals that
                haven&apos;t formally applied yet.{" "}
                <Link href={projectsHref(f.proposals)} className="text-primary underline underline-offset-2">
                  Show proposals
                </Link>
              </span>
            )}
          </p>
        </Section>
      )}

      {yearCompleted && yearApplied && (
        <div className="flex flex-wrap gap-4">
          <Section
            className="flex-[1_1_420px]"
            title={`Completed in ${period.year}`}
            description={`Projects with units completed in ${period.year}, by units added.`}
          >
            <YearProjectsTable list={yearCompleted} href={projectsHref(f.added)} empty={`Nothing completed here in ${period.year}.`} />
          </Section>
          <Section
            className="flex-[1_1_420px]"
            title={`What happened to ${period.year}'s applications`}
            description="Projects that applied that year, with where each stands today."
          >
            <YearProjectsTable list={yearApplied} href={projectsHref(f.appliedAll)} empty={`No applications here in ${period.year}.`} />
          </Section>
        </div>
      )}

      {!period.ytd && <WhatGotFinished report={report} where={where} period={period} />}

      <div className="flex flex-wrap gap-4">
        {moves && (
          <Section
            id="movement"
            className="flex-[1_1_520px]"
            title="Movement"
            aside={
              <div role="group" aria-label="Period" className="flex gap-1">
                {(Object.keys(MOVEMENT_PERIODS) as MovementPeriod[]).map((m) => (
                  <Link
                    key={m}
                    href={`${place.hrefWith({ year: settings.year, asof: settings.asof, sort: settings.sort, moves: m, all: settings.all })}#movement`}
                    scroll={false}
                    aria-current={m === settings.moves}
                    className={cn(chip, "min-h-9 rounded-lg px-2.5 text-[13px]")}
                  >
                    {MOVEMENT_PERIOD_LABELS[m]}
                  </Link>
                ))}
              </div>
            }
          >
            <MovementFeed moves={moves} showPlace={false} empty={`Nothing moved here in the last ${MOVEMENT_PERIOD_LABELS[settings.moves]}.`} />
            {notificationsConfigured() && (
              <SubscribeForm where={where} label={place.radiusLabel} placeName={place.name} status={settings.subscription} />
            )}
          </Section>
        )}
        <Section
          className="flex-[1_1_360px]"
          title="The long view"
          description={`Net homes completed per year in ${place.name}, and its share of the city's.`}
        >
          <LongView points={report.longView} events={events} where={where} period={period} today={today} showShare />
        </Section>
      </div>
    </>
  );
}
