import type { Metadata } from "next";
import { connection } from "next/server";
import { MF_LARGE_MIN_UNITS, MF_MID_MIN_UNITS } from "@sbt/data/domain/housing-type";
import { BOUNDARY_SOURCES } from "@sbt/data/reference/sources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { CONCENTRATION_THRESHOLD, MIN_PROJECTS } from "@/lib/reliability";
import {
  EXPIRING_SOON_MONTHS,
  FEED_MIN_UNITS,
  STALLED_ISSUED_YEARS,
  STALLED_REVIEW_YEARS,
} from "@/lib/rules";
import { getExclusions, getHousingTypeAccuracy } from "@/lib/server/about";
import { getFreshness } from "@/lib/server/metrics";

export const metadata: Metadata = { title: "About the data" };

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-[15px] leading-relaxed">{children}</CardContent>
    </Card>
  );
}

/** P5: where the numbers come from, what's counted, and how labels are decided. */
export default async function AboutPage() {
  await connection();
  const [x, accuracy, freshness] = await Promise.all([getExclusions(), getHousingTypeAccuracy(), getFreshness()]);
  const synced = freshness.lastSuccessAt
    ? new Date(freshness.lastSuccessAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      })
    : "never";
  const rows: [string, string, number | null, number | null][] = [
    ["Proposals not yet applied for", "On file with the City but not formally applied for; no dates are published. Shown separately, never in the pipeline.", x.pre_intake_permits, x.pre_intake_units],
    ["Units “added” on demolition permits", "Demolitions only count toward units removed. Some also report the replacement building's units, which are counted on its building permit instead.", x.demolition_added_permits, x.demolition_units_added],
    ["Shoring and excavation permits", "They restate the units of the building they prepare the site for. Counted once, on the building permit.", x.site_prep_permits, x.site_prep_units],
    ["Repeated development totals", "Permits for one site’s buildings that each list the whole site’s units: counted once. Applies to permits at one address applied for the same day with the same 3+ units, and to three or more permits on one street in a year listing the same 50+ units.", x.restated_permits, x.restated_units],
    ["Finished permits with no completion date", "The City marks them done (e.g. Closed) but records no completion date, so they can't be placed in a year and aren't in homes completed. Their projects still show as completed.", x.done_no_date_permits, x.done_no_date_units],
    ["Cancelled or lapsed demolitions", "Not counted as units removed.", null, x.demolition_units_uncounted],
    ["Permits without a location", "In citywide totals, but in no neighborhood, center or radius.", x.unlocated_permits, x.unlocated_units],
    ["Permits the City has removed", "No longer in the City's dataset.", x.removed, null],
  ];

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">About the data</h1>
        <p className="text-muted-foreground text-[17px]">
          Every number here comes from the City of Seattle&apos;s public building permit records, and every number opens the projects behind
          it. This page says what&apos;s counted and how the labels are decided.
        </p>
      </div>

      <Block id="source" title="Source">
        <p>
          The City&apos;s{" "}
          <a href="https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr" className="text-primary underline underline-offset-2">
            Building Permits dataset
          </a>{" "}
          on the Seattle Open Data Portal, copied in full every night. Last successful sync: <strong>{synced}</strong>. If the City&apos;s
          records and this app disagree, the City is right; the next sync picks up the change. Each page warns when the last sync failed
          or is more than two days old.
        </p>
      </Block>

      <Block id="counting" title="What's counted">
        <p>
          <strong>Every building permit that adds housing units counts toward units added</strong>, whatever its permit class, including
          “Commercial” mixed-use buildings: {formatNumber(x.housing_permits)} permits, {formatNumber(x.housing_units)} units.{" "}
          <strong>Demolition permits count only toward units removed.</strong>
        </p>
        <p>
          <strong>Homes completed</strong> is net: units added by permits completed in the period, minus units removed in the same
          period by demolitions and by building permits that remove units. Units removed are always shown next to it.{" "}
          <strong>Demolitions are dated by when they were issued, not when they were completed</strong>: demolition usually follows soon
          after issue, but the City often records the completion years later. A recorded completion date counts as completed even if the
          City&apos;s status says expired or still issued; cancelled, denied and withdrawn permits never count. <strong>Homes permitted</strong> and{" "}
          <strong>homes applied for</strong> are the units on permits issued or applied for in the period.
        </p>
        <p>
          A <strong>project</strong> is every permit on one development site, as the City links them, including demolitions; a permit
          with no site is its own project. There are {formatNumber(x.projects)} projects, {formatNumber(x.multiPermitProjects)} of them
          with more than one building permit. Units are credited per permit, as each building reaches its milestone.
        </p>
        <div className="rounded-lg border">
          <Table className="min-w-[640px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Left out</TableHead>
                <TableHead>Why</TableHead>
                <TableHead className="text-right">Permits</TableHead>
                <TableHead className="text-right">Units</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([what, why, permits, units]) => (
                <TableRow key={what}>
                  <TableCell className="font-medium">{what}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{why}</TableCell>
                  <TableCell className="text-right tabular-nums">{permits === null ? "—" : formatNumber(permits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{units === null ? "—" : formatNumber(units)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Block>

      <Block id="stages" title="Stages">
        <p>
          Every project is at one stage, taken from its <strong>main permit</strong>: the one with the most units, which also sets its
          housing type. <strong>In review</strong>: applied, not issued. <strong>Issued</strong>: issued, not completed.{" "}
          <strong>Completed</strong>: roughly final inspection or occupancy, which can lag move-in by weeks to months.{" "}
          <strong>Permit expired</strong>: issued, then past its expiration date with no completion, even if the City still lists it as
          issued. Seattle construction permits expire 18 months after issue unless renewed. <strong>Dead</strong>: cancelled, denied,
          withdrawn, or expired before being issued. The <strong>pipeline</strong> is projects in review or issued; its units are those on
          permits not yet completed.
        </p>
        <p>
          An expired permit might mean the project stalled or was abandoned, the building was finished but the final inspection was never
          recorded, or the work moved to another permit. The data can&apos;t tell these apart. Expired projects never count as completed, and
          a renewal returns a project to “issued”.
        </p>
      </Block>

      <Block id="stalled" title="Stalled and expiring soon">
        <p>
          A pipeline project is <strong>stalled</strong> if it has been in review for {STALLED_REVIEW_YEARS} years or more, or was issued{" "}
          {STALLED_ISSUED_YEARS} years ago or more and isn&apos;t completed. <strong>Expiring soon</strong>: issued, with a permit that
          expires within {EXPIRING_SOON_MONTHS} months. Both are fixed rules anyone can check against the dates shown.
        </p>
      </Block>

      <Block id="movement" title="Movement">
        <p>
          Movement is a dated change in a project&apos;s progress: it applied, was issued or completed, its permit expired, or it died.
          Each carries the City&apos;s own date. A death with no City date is dated by when this app first noticed it, and labelled
          “noticed”; the app began recording changes in October 2026, so earlier deaths without a City date aren&apos;t shown. A project
          only shows as died if the whole project is dead now. The front page lists projects of {FEED_MIN_UNITS} or more homes.
        </p>
        <p>
          The City&apos;s data sometimes blinks: in late October 2026 it cleared the expiration date on almost every permit for three days,
          then restored the same dates. Movement never reads those recorded changes, and the nightly sync now refuses a snapshot that
          suddenly lacks a field it had.
        </p>
      </Block>

      <Block id="places" title="Places">
        <p>
          <strong>Neighborhoods</strong> are the {BOUNDARY_SOURCES.neighborhoods.publisher}&apos;s{" "}
          <a href={BOUNDARY_SOURCES.neighborhoods.item} className="text-primary underline underline-offset-2">
            {BOUNDARY_SOURCES.neighborhoods.name}
          </a>{" "}
          (downloaded {BOUNDARY_SOURCES.neighborhoods.retrieved}). {BOUNDARY_SOURCES.neighborhoods.note} A permit just outside every
          neighborhood (on a pier or shoreline) goes to the nearest one within 50 m.
        </p>
        <p>
          <strong>Urban villages and centers</strong> are the{" "}
          <a href={BOUNDARY_SOURCES.centers.item} className="text-primary underline underline-offset-2">
            {BOUNDARY_SOURCES.centers.name}
          </a>{" "}
          layer from the {BOUNDARY_SOURCES.centers.publisher} (downloaded {BOUNDARY_SOURCES.centers.retrieved}). {BOUNDARY_SOURCES.centers.note}{" "}
          They overlap neighborhoods, so totals are never added across the two.
        </p>
        <p>
          <strong>Radius reports</strong> count permits within ¼, ½ or 1 mile of a point: an address, a point on a street, or the middle of a place. Addresses are found with the City&apos;s
          geocoder. Search also knows informal names such as “U District”, “Capitol Hill” and “the Junction”.
        </p>
      </Block>

      <Block id="housing-type" title="Housing types">
        <p>
          Detached house · ADU/DADU · Townhouse/rowhouse · Small multifamily (under {MF_MID_MIN_UNITS} units) · Mid-size multifamily (
          {MF_MID_MIN_UNITS}–{MF_LARGE_MIN_UNITS - 1}) · Large multifamily ({MF_LARGE_MIN_UNITS}+) · Other/unknown. The City records a
          dwelling type on some permits; where it doesn&apos;t, the type is inferred from the permit&apos;s category, class, unit count and
          description, and pages show the share inferred. On permits where the City did record a type ({accuracy.from}–{accuracy.to}),
          the inference matches it for {Math.round(accuracy.unitAccuracy * 100)}% of units.
        </p>
      </Block>

      <Block id="reliability" title="Small numbers">
        <p>
          Every total shows how many projects are behind it. If one project makes up more than {Math.round(CONCENTRATION_THRESHOLD * 100)}%
          of a total, the total names it. Percent changes and shares are hidden when fewer than {MIN_PROJECTS} projects are behind them;
          the raw numbers and project lists are always shown.
        </p>
      </Block>

      <Block id="provisional" title="Provisional numbers and known quirks">
        <p>
          <strong>This year is provisional.</strong> Completions are sometimes recorded weeks or months late, so recent totals can still
          rise. This year is always compared with the same dates last year.
        </p>
        <p>
          <strong>Missing locations</strong>: {formatNumber(x.unlocated_permits)} housing permits have no usable location. They count
          citywide but not in any place. <strong>Inferred housing types</strong>: see above. <strong>Late or missing final
          inspections</strong> show up as expired permits.
        </p>
      </Block>
    </>
  );
}
