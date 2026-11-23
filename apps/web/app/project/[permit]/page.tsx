import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { InfoTip } from "@/components/info-tip";
import { partlyNote } from "@/components/pipeline-table";
import { Section } from "@/components/section";
import { FlagBadge, StageBadge } from "@/components/stage-badge";
import { streetViewUrl } from "@/components/street-view-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { placeHref, type Stage } from "@/lib/filters";
import {
  formatDate,
  formatDuration,
  formatNumber,
  unitsCount,
  housingTypeLabel,
  STAGE_LONG_LABELS,
  unitsNoun,
} from "@/lib/format";
import { STALLED_ISSUED_YEARS, STALLED_REVIEW_YEARS } from "@/lib/rules";
import { getMovement } from "@/lib/server/movement";
import { getOtherPermitsAtAddress, getProject, type ProjectDetail } from "@/lib/server/projects";
import { filtersCache } from "@/lib/server/search-params";
import { getToday } from "@/lib/server/today";
import { cn } from "@/lib/utils";

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

type Props = { params: Promise<{ permit: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject(safeDecode((await params).permit), await getToday());
  return { title: project?.address ?? "Project not found" };
}

const EXPIRED_EXPLAINER =
  "An expired permit can mean the project stalled or was abandoned, that it was finished but the final inspection was never recorded, or that the work moved to another permit. The data can't tell which.";

function stalledThreshold(stage: Stage): string | null {
  if (stage === "review") return `stalled at ${STALLED_REVIEW_YEARS} years`;
  if (stage === "issued") return `stalled at ${STALLED_ISSUED_YEARS} years`;
  return null;
}

/** P4: what's going on with this project? */
export default async function ProjectPage({ params, searchParams }: Props) {
  const permit = safeDecode((await params).permit);
  const { asof } = await filtersCache.parse(searchParams);
  const today = await getToday(asof);
  const p = await getProject(permit, today);
  if (!p) notFound();
  const [moves, others] = await Promise.all([lastMovement(p, today), getOtherPermitsAtAddress(p.address, p.projectKey)]);
  // Only a hint, never a claim: a later permit at the same address was issued or completed.
  const laterWork =
    p.stage === "expired" && p.issuedDate
      ? others.find((o) => (o.issuedDate && o.issuedDate > p.issuedDate!) || (o.completedDate && o.completedDate > p.issuedDate!))
      : undefined;
  const partly = partlyNote(p);
  const threshold = stalledThreshold(p.stage);
  const cityStillIssued = p.stage === "expired" && /issued/i.test(p.cityStatus ?? "");
  const replacement = p.unitsRemoved > 0 ? (p.unitsAdded / p.unitsRemoved).toFixed(1) : null;

  return (
    <>
      {p.hoodId && (
        <Link href={placeHref({ kind: "neighborhood", id: p.hoodId })} className="text-primary text-sm">
          ← {p.hoodName}
        </Link>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={p.stage} className="h-6 px-2.5" />
            {p.stalled && <FlagBadge stage={p.stage} stalled expiring={false} />}
            {p.expiring && <FlagBadge stage={p.stage} stalled={false} expiring />}
            {cityStillIssued && <span className="text-muted-foreground text-[13px]">City status still shows “{p.cityStatus}”</span>}
            {partly && <span className="text-muted-foreground text-[13px]">{partly}</span>}
          </div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight break-words">{p.address ?? p.mainPermit}</h1>
          <p className="text-foreground/80 text-[17px]">
            {[
              p.unitsAdded > 0 ? unitsNoun(p.unitsAdded, p.housingType) : null,
              housingTypeLabel(p.housingType),
              p.hoodName,
              p.centerName,
            ]
              .filter(Boolean)
              .map((x, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {i === 2 && p.hoodId ? (
                    <Link href={placeHref({ kind: "neighborhood", id: p.hoodId })} className="hover:underline">
                      {x}
                    </Link>
                  ) : i === 3 && p.centerId ? (
                    <Link href={placeHref({ kind: "center", id: p.centerId })} className="hover:underline">
                      {x}
                    </Link>
                  ) : (
                    x
                  )}
                </span>
              ))}
            {p.housingTypeSource === "inferred" && (
              <InfoTip anchor="housing-type" label="How the type was decided">
                The City didn&apos;t record a dwelling type on this permit, so the type is inferred from its description and unit count.
              </InfoTip>
            )}
          </p>
          {p.description && (
            <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
              “{p.description.length > 280 ? `${p.description.slice(0, 280)}…` : p.description}”
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {p.link && (
              <Button asChild className="h-11 px-4">
                <a href={p.link} target="_blank" rel="noreferrer">
                  Open City record <ExternalLink />
                </a>
              </Button>
            )}
            {p.lat != null && p.lng != null && (
              <Button asChild variant="outline" className="h-11 px-4">
                <a href={streetViewUrl(p.lat, p.lng)} target="_blank" rel="noreferrer">
                  Street View (may predate the permit) <ExternalLink />
                </a>
              </Button>
            )}
          </div>
        </section>

        <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 px-5 py-5">
          <h2 className="text-base font-semibold">Where it stands</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Stage</dt>
            <dd className="font-semibold">{STAGE_LONG_LABELS[p.stage]}</dd>
            {p.stage === "completed" ? (
              <>
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="font-semibold">
                  {formatDate(p.completedDate ?? p.stageSince)}{" "}
                  {p.appliedDate && (p.completedDate ?? p.stageSince) && (
                    <span className="text-muted-foreground font-normal">
                      ({formatDuration(p.appliedDate, (p.completedDate ?? p.stageSince)!)} after applying)
                    </span>
                  )}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">In stage</dt>
                <dd className="font-semibold">
                  {p.stageSince ? formatDuration(p.stageSince, today) : "—"}{" "}
                  {threshold && <span className="text-muted-foreground font-normal">({threshold})</span>}
                </dd>
                {p.stage !== "dead" && (
                  <>
                    <dt className="text-muted-foreground">{p.stage === "expired" ? "Permit expired" : "Permit expires"}</dt>
                    <dd className="font-semibold">
                      {formatDate(p.expiresDate)}{" "}
                      {p.expiresDate && p.expiresDate < today && (
                        <span className="text-muted-foreground font-normal">({formatDuration(p.expiresDate, today)} ago)</span>
                      )}
                    </dd>
                  </>
                )}
              </>
            )}
            <dt className="text-muted-foreground">Last movement</dt>
            <dd className="font-semibold">
              {moves ? `${MOVE_LABELS[moves.kind]}, ${formatDate(moves.date)}` : p.lastMovement ? formatDate(p.lastMovement) : "—"}
            </dd>
          </dl>
          {laterWork && (
            <p className="text-[13px] leading-relaxed">
              Later permits at this address suggest work continued: {laterWork.permitNum}{" "}
              {laterWork.completedDate && laterWork.completedDate > p.issuedDate!
                ? `was completed ${formatDate(laterWork.completedDate)}`
                : `was issued ${formatDate(laterWork.issuedDate)}`}
              .{" "}
              <a href="#other-permits" className="text-primary underline underline-offset-2">
                See them
              </a>
            </p>
          )}
          {p.stage === "expired" && (
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              {EXPIRED_EXPLAINER}{" "}
              <Link href="/about#stages" className="text-primary underline underline-offset-2">
                What “permit expired” means
              </Link>
            </p>
          )}
        </Card>
      </div>

      <Section title="Timeline" description="The main permit's milestones (the permit with the most units).">
        <Timeline p={p} today={today} />
      </Section>

      <Section
        title="Permits on this site"
        aside={
          <span className="tabular-nums">
            Units added: {formatNumber(p.unitsAdded)} · removed: {formatNumber(p.unitsRemoved)}
            {replacement && ` · replacement ratio: ${replacement}`}
            <InfoTip anchor="counting" label="What the ratio means">
              Units added per unit demolished on this development site. Units on dead permits are left out unless every permit died, since
              they were usually replaced by a later permit.
            </InfoTip>
          </span>
        }
      >
        <div className="rounded-lg border">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Permit</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>City status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.permits.map((x) => (
                <TableRow key={x.permitNum}>
                  <TableCell className="font-mono text-xs">
                    {x.link ? (
                      <a href={x.link} target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">
                        {x.permitNum}
                      </a>
                    ) : (
                      x.permitNum
                    )}
                    {x.permitNum === p.mainPermit && <div className="text-muted-foreground font-sans">main permit</div>}
                  </TableCell>
                  <TableCell>
                    {x.permitType === "Demolition" ? "Demolition" : (x.typeDesc ?? x.permitType)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {x.added > 0 && <div>+{formatNumber(x.added)}</div>}
                    {x.removed > 0 && <div className={cn(!x.removalCounted && "text-muted-foreground line-through")}>−{formatNumber(x.removed)}</div>}
                    {x.added === 0 && x.removed === 0 && <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(x.appliedDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(x.issuedDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(x.completedDate)}</TableCell>
                  <TableCell>
                    {x.cityStatus ?? "—"}
                    {x.stage === "expired" && !/expired/i.test(x.cityStatus ?? "") && (
                      <div className="text-muted-foreground text-xs">past its expiry ({formatDate(x.expiresDate)})</div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      {others.length > 0 && (
        <Section
          id="other-permits"
          title="Other permits at this address"
          description="Permits at the same address that the City doesn't link to this project, including ones that add no homes (shoring, tenant improvements). They aren't counted in this project's numbers."
        >
          <div className="rounded-lg border">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Permit</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>City status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {others.map((o) => (
                  <TableRow key={o.permitNum}>
                    <TableCell className="font-mono text-xs">
                      {o.link ? (
                        <a href={o.link} target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">
                          {o.permitNum}
                        </a>
                      ) : (
                        o.permitNum
                      )}
                    </TableCell>
                    <TableCell>
                      {o.permitType === "Building" ? (o.typeDesc ?? o.permitType) : o.permitType}
                      {o.units > 0 && <div className="text-muted-foreground text-xs">+{unitsCount(o.units)}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-80 text-xs whitespace-normal">
                      {o.description && o.description.length > 160 ? `${o.description.slice(0, 160)}…` : o.description}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.appliedDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.issuedDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.completedDate)}</TableCell>
                    <TableCell>{o.cityStatus ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
    </>
  );
}

const MOVE_LABELS = { applied: "Applied", issued: "Issued", completed: "Completed", expired: "Permit expired", died: "Died" } as const;

/** The project's most recent movement (SPEC P4 "Where it stands"). */
async function lastMovement(p: ProjectDetail, today: string) {
  const [latest] = await getMovement({}, today, { days: 365 * 80, projectKey: p.projectKey, limit: 1 });
  return latest ?? null;
}

function Timeline({ p, today }: { p: ProjectDetail; today: string }) {
  const steps: { title: string; date: string | null; note: string; state: "done" | "warn" | "todo" }[] = [
    { title: "Applied", date: p.appliedDate, note: "Building permit application", state: p.appliedDate ? "done" : "todo" },
    {
      title: "Issued",
      date: p.issuedDate,
      note: p.issuedDate && p.appliedDate ? `${formatDuration(p.appliedDate, p.issuedDate)} in review` : p.stage === "review" ? `In review for ${formatDuration(p.appliedDate, today)}` : "",
      state: p.issuedDate ? "done" : "todo",
    },
  ];
  if (p.stage === "expired")
    steps.push({
      title: "Permit expired",
      date: p.expiresDate,
      note: `No completion recorded${p.issuedDate && p.expiresDate ? `, ${formatDuration(p.issuedDate, p.expiresDate)} after issue` : ""}. Not renewed, as far as the data shows.`,
      state: "warn",
    });
  steps.push({
    title: "Completed",
    date: p.completedDate,
    note: p.completedDate
      ? `${p.issuedDate ? `${formatDuration(p.issuedDate, p.completedDate)} after issue. ` : ""}Final inspection or occupancy`
      : "Final inspection or occupancy",
    state: p.completedDate ? "done" : "todo",
  });
  if (p.stage === "dead") steps.push({ title: "Died", date: null, note: "Cancelled, withdrawn, denied or expired before issue", state: "warn" });
  const dot = { done: "bg-primary border-primary", warn: "bg-card border-trend-down", todo: "bg-card border-border" };
  const line = { done: "bg-primary", warn: "bg-trend-down/60", todo: "bg-border" };
  return (
    <ol className="grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] sm:gap-0">
      {steps.map((s, i) => (
        <li key={s.title} className="flex flex-col gap-2 sm:pr-4">
          <div className="flex items-center">
            <span aria-hidden className={cn("size-4.5 flex-none rounded-full border-[3px]", dot[s.state])} />
            {i < steps.length - 1 && <span aria-hidden className={cn("hidden h-[3px] flex-1 sm:block", line[s.state])} />}
          </div>
          <span className="text-[15px] font-semibold">{s.title}</span>
          <span className="text-sm">{s.date ? formatDate(s.date) : "Not yet"}</span>
          {s.note && <span className="text-muted-foreground text-[13px] leading-snug">{s.note}</span>}
        </li>
      ))}
    </ol>
  );
}
