import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { LongView } from "@/components/long-view";
import { MovementFeed } from "@/components/project-list-items";
import { PlaceSearch } from "@/components/place-search";
import { Ranking, type RankingRow } from "@/components/ranking";
import { Section } from "@/components/section";
import { Biggest, EarlyYearNotice, Headline, WhatGotFinished, YearStepper } from "@/components/year-report";
import { placeHref, projectsHref } from "@/lib/filters";
import { formatNumber } from "@/lib/format";
import { periodFor, resolveYear } from "@/lib/period";
import { FEED_DAYS, FEED_MIN_UNITS } from "@/lib/rules";
import { getPolicyEvents, totalsBy } from "@/lib/server/metrics";
import { getMovement } from "@/lib/server/movement";
import { listPlaceOptions } from "@/lib/server/places";
import { getYearReport, reportFilters } from "@/lib/server/report";
import { reportCache } from "@/lib/server/search-params";
import { UNLOCATED } from "@/lib/server/scope";
import { getToday } from "@/lib/server/today";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { year } = await reportCache.parse(searchParams);
  return { title: year ? `Seattle housing in ${year}` : "Seattle housing this year" };
}

/** P1: how is Seattle doing on housing this year? */
export default async function ThisYearPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await reportCache.parse(searchParams);
  const today = await getToday(params.asof);
  const currentYear = Number(today.slice(0, 4));
  const resolved = resolveYear(params.year, today);
  const period = periodFor(resolved.year, today);
  const where = {};
  const f = reportFilters(where, period);
  const yearHref = (y: number) => `/?year=${y}${params.asof ? `&asof=${params.asof}` : ""}`;

  const [report, ranking, places, moves, events] = await Promise.all([
    getYearReport(where, period, today),
    totalsBy(f.completed, today, "hood"),
    listPlaceOptions(today),
    period.ytd ? getMovement(where, today, { days: FEED_DAYS, minProjectUnits: FEED_MIN_UNITS }) : null,
    getPolicyEvents(),
  ]);
  const names = new Map(places.map((p) => [p.id, p.name]));
  const located = ranking.filter((r) => r.key);
  const unlocated = ranking.find((r) => !r.key);
  const rows: RankingRow[] = located.map((r) => ({
    id: r.key,
    name: names.get(r.key) ?? r.key,
    units: r.units,
    projects: r.projects,
    placeHref: placeHref({ kind: "neighborhood", id: r.key }, { year: period.year, asof: params.asof }),
    unitsHref: projectsHref({ ...f.completed, hood: r.key }),
  }));

  return (
    <>
      {resolved.earlyInYear && <EarlyYearNotice currentYear={currentYear} href={yearHref(currentYear)} />}
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2">
          <YearStepper period={period} currentYear={currentYear} hrefFor={yearHref} />
          <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">Seattle housing in {period.year}</h1>
          <p className="text-muted-foreground max-w-2xl text-base">
            {period.ytd
              ? `Every figure compares this year so far with the same dates in ${period.year - 1}. This year's numbers are provisional: completions are sometimes recorded late.`
              : `The whole of ${period.year}, compared with ${period.year - 1}.`}
          </p>
        </div>
        <div className="flex w-full max-w-md flex-[1_1_380px] flex-col gap-1.5">
          <label htmlFor="place-search" className="text-sm font-semibold">
            How&apos;s it going in…
          </label>
          <PlaceSearch places={places} />
          <span className="text-muted-foreground text-xs">
            Try <Link href="/place/roosevelt" className="text-primary">Roosevelt</Link>,{" "}
            <Link href="/place/ballard" className="text-primary">Ballard</Link>,{" "}
            <Link href="/place/columbia-city" className="text-primary">Columbia City</Link>
          </span>
        </div>
      </section>

      <Headline report={report} where={where} period={period} />

      <WhatGotFinished report={report} where={where} period={period} />

      <div className="flex flex-wrap gap-4">
        <Section
          className="flex-1 basis-[360px]"
          title="Where it's happening"
          description={
            <>
              Neighborhoods ranked by homes completed {period.ytd ? "this year" : `in ${period.year}`}. A name opens its place report; a
              number opens its projects.
              {unlocated && unlocated.units !== 0 && (
                <>
                  {" "}
                  <Link href={projectsHref({ ...f.completed, hood: UNLOCATED })} className="underline underline-offset-2">
                    {formatNumber(unlocated.units)}
                  </Link>{" "}
                  more have no location.
                </>
              )}
            </>
          }
        >
          <Ranking rows={rows} />
        </Section>
        <Biggest report={report} period={period} />
      </div>

      {moves && (
        <Section
          title="Recent movement"
          description={`Projects of ${FEED_MIN_UNITS} or more homes that applied, were issued, completed, had their permit expire or died in the last ${FEED_DAYS} days.`}
          aside={
            <Link href="/movement" className="text-primary text-sm font-medium">
              All movement citywide →
            </Link>
          }
        >
          <MovementFeed moves={moves} empty={`No projects of ${FEED_MIN_UNITS}+ homes moved in the last ${FEED_DAYS} days.`} />
        </Section>
      )}

      <Section title="The long view: net homes completed per year" aside={`${currentYear} is year to date`}>
        <LongView points={report.longView} events={events} where={where} period={period} today={today} showShare={false} />
      </Section>
    </>
  );
}
