import type { Metadata } from "next";
import { connection } from "next/server";
import { HOUSING_TYPE_LABELS, MF_LARGE_MIN_UNITS, MF_MID_MIN_UNITS } from "@sbt/data/domain/housing-type";
import { STATUS_VALUES } from "@sbt/data/domain/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { CONCENTRATION_THRESHOLD, MIN_PROJECTS } from "@/lib/reliability";
import { getDwellingTypeCoverage, getExclusions, getHousingTypeAccuracy } from "@/lib/server/methodology";

export const metadata: Metadata = { title: "What we count · Seattle Housing Tracker" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** SPEC T6: the page a skeptical reader can check the app against. Generated from the same definitions the app uses. */
export default async function MethodologyPage() {
  // Live counts: render per request, never at build time.
  await connection();
  const [x, accuracy, coverage] = await Promise.all([getExclusions(), getHousingTypeAccuracy(), getDwellingTypeCoverage()]);

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">What we count</h1>
        <p className="text-muted-foreground text-sm">
          Every number in this app comes from the City of Seattle&apos;s public building permit records. This page explains
          exactly which permits are counted, what&apos;s left out and why, with live counts.
        </p>
      </div>

      <Section id="counting" title="What's counted">
        <p>
          <strong>Every building permit that adds housing units, whatever the City&apos;s permit class.</strong> That
          includes mixed-use buildings the City classes as &ldquo;Commercial&rdquo;. Right now that&apos;s{" "}
          {formatNumber(x.housing_permits)} permits adding {formatNumber(x.housing_units)} units.
        </p>
        <p>
          Units are credited to the date each permit reaches a milestone: <em>applied</em>, <em>issued</em> or{" "}
          <em>completed</em>. &ldquo;Completed&rdquo; is the City&apos;s completion date, roughly the final inspection. It can
          lag move-in by weeks to months, so the most recent months are provisional.
        </p>
        <p>
          Unit totals are currently <strong>gross</strong>: units added, not net of demolitions. Demolition permits record{" "}
          {formatNumber(x.demolition_units_removed)} units removed; net figures will be added once that data is validated.
        </p>
      </Section>

      <Section id="projects" title="Permits and projects">
        <p>
          The City links permits for the same development through a &ldquo;development site&rdquo;. We group those into{" "}
          <strong>projects</strong>: {formatNumber(x.projects)} projects, of which {formatNumber(x.multiPermitProjects)} span
          more than one building permit (for example, a row of townhouses permitted building by building).
        </p>
        <p>
          Units are still counted per permit, as each building reaches its milestone. Counts of developments, and the
          reliability rule below, use projects, so 45 townhouse permits on one site count as one development.
        </p>
      </Section>

      <Section id="exclusions" title="What's left out, and how much">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Left out</TableHead>
              <TableHead>Why</TableHead>
              <TableHead className="text-right">Permits</TableHead>
              <TableHead className="text-right">Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Pre-application proposals</TableCell>
              <TableCell className="whitespace-normal">
                In the City&apos;s system but not formally applied for. Many are long abandoned, and the City publishes no
                dates for them.
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.pre_intake_permits)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.pre_intake_units)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Building permits that add no units</TableCell>
              <TableCell className="whitespace-normal">Alterations, commercial work, garages and so on.</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.no_units_permits)}</TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Units &ldquo;added&rdquo; on demolition permits</TableCell>
              <TableCell className="whitespace-normal">
                Demolition permits sometimes report the units of the replacement building. Those are counted on the
                building permit instead, to avoid double counting.
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.demolition_permits)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.demolition_units_added)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Shoring and excavation permits</TableCell>
              <TableCell className="whitespace-normal">
                Site-preparation permits that restate the units of the building they dig the hole for, often without being
                linked to it. Those units are counted once, on the building permit.
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.site_prep_permits)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.site_prep_units)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Permits without a location</TableCell>
              <TableCell className="whitespace-normal">
                Counted in citywide totals but not in any area, map or radius view.
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.unlocated_permits)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.unlocated_units)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Permits the City has removed</TableCell>
              <TableCell className="whitespace-normal">No longer in the City&apos;s dataset; kept for history only.</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(x.removed)}</TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-muted-foreground">
          Roof, grading and environmental exemption permits aren&apos;t imported at all; they never add housing.
        </p>
      </Section>

      <Section id="status" title="Status categories" description="How every City status maps to the four categories used throughout the app.">
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="font-medium">Pipeline</dt>
            <dd className="text-muted-foreground">Not finished and not dead: {STATUS_VALUES.pipeline.join(", ")}.</dd>
          </div>
          <div>
            <dt className="font-medium">Done</dt>
            <dd className="text-muted-foreground">Construction finished: {STATUS_VALUES.done.join(", ")}.</dd>
          </div>
          <div>
            <dt className="font-medium">Lapsed</dt>
            <dd className="text-muted-foreground">
              Issued, then expired: {formatNumber(x.lapsed_permits)} permits, {formatNumber(x.lapsed_units)} units. Seattle
              construction permits expire 18 months after issuance unless renewed. The project may have been abandoned, may
              have been finished without a recorded final inspection, or may have continued under another permit. The data
              can&apos;t tell which, so lapsed units are never counted as built or as dead.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Dead</dt>
            <dd className="text-muted-foreground">
              Won&apos;t be built under this permit: {STATUS_VALUES.dead.join(", ")}, or Expired before ever being issued.
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground">
          If the City introduces a status not listed here, the nightly update fails rather than guessing.
        </p>
      </Section>

      <Section id="housing-type" title="Housing types">
        <div className="flex flex-wrap gap-2">
          {Object.values(HOUSING_TYPE_LABELS).map((l) => (
            <Badge key={l} variant="secondary">{l}</Badge>
          ))}
        </div>
        <p>
          Each permit gets one type. We use the City&apos;s recorded dwelling type when there is one. A new house built
          together with ADUs counts as ADU/DADU. Multifamily buildings are split by units added: small (under{" "}
          {MF_MID_MIN_UNITS}), mid-size ({MF_MID_MIN_UNITS}–{MF_LARGE_MIN_UNITS - 1}) and large ({MF_LARGE_MIN_UNITS}+).
        </p>
        <p>
          The City has largely stopped recording dwelling types (
          {coverage.map((c) => `${c.year}: ${c.coverage}%`).join(", ")} of applications), so recent types are mostly{" "}
          <strong>inferred</strong> from the housing category, permit class, unit count and description. To check the
          inference, we hide the City&apos;s type on {formatNumber(accuracy.compared)} permits from {accuracy.from}–
          {accuracy.to} and compare: it matches for {pct(accuracy.permitAccuracy)} of permits and {pct(accuracy.unitAccuracy)}{" "}
          of units.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Units checked</TableHead>
              <TableHead className="text-right">Found (recall)</TableHead>
              <TableHead className="text-right">Correct when guessed (precision)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accuracy.byType
              .filter((t) => t.units > 0)
              .map((t) => (
                <TableRow key={t.type}>
                  <TableCell>{HOUSING_TYPE_LABELS[t.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(t.units)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(t.recallUnits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(t.precisionUnits)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground">
          Detached houses are the weakest: the inference tends to label them as townhouses or ADUs, so recent detached-house
          counts are likely understated.
        </p>
      </Section>

      <Section id="reliability" title="How reliable is a number?">
        <p>Every total shows how many projects are behind it. Two rules apply everywhere:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            If one project makes up more than {Math.round(CONCENTRATION_THRESHOLD * 100)}% of the units, the total is flagged,
            because it mostly reflects a single development.
          </li>
          <li>
            Percent changes, medians, shares and rankings aren&apos;t computed when fewer than {MIN_PROJECTS} projects are
            behind them. Raw counts are always shown.
          </li>
        </ul>
        <p className="text-muted-foreground">
          The threshold of {MIN_PROJECTS} projects is provisional and will be calibrated against how often small-sample
          changes reverse the following year.
        </p>
      </Section>

      <Section id="quirks" title="Known data quirks">
        <ul className="list-disc space-y-1 pl-5">
          <li>The City uses 1900-01-01 as a placeholder for unknown dates. We treat it as missing.</li>
          <li>Completion dates are sometimes recorded late, so the last few months tend to rise after the fact.</li>
          <li>Coordinates outside Seattle are treated as missing.</li>
        </ul>
      </Section>
    </>
  );
}
