import { formatNumber, homes, unitsCount } from "@/lib/format";
import type { Period } from "@/lib/period";
import type { ProjectRow } from "@/lib/server/projects";
import type { YearReport } from "@/lib/server/report";

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const monthName = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
const word = (n: number) => NUMBER_WORDS[n] ?? formatNumber(n);

function comparePhrase(current: number, previous: number, when: string): string {
  if (previous === 0 && current === 0) return `none ${when} either`;
  if (Math.abs(current - previous) <= Math.max(2, 0.05 * Math.abs(previous))) return `about the same as ${when} (${formatNumber(previous)})`;
  return `${current > previous ? "up" : "down"} from ${formatNumber(previous)} ${when}`;
}

/** A one- or two-sentence plain-language summary of a place's year (SPEC P3). */
export function placeSummary(report: YearReport, period: Period, largestPipeline: ProjectRow[]): string {
  const c = report.completed.current.totalUnits ?? 0;
  const p = report.completed.previous.totalUnits ?? 0;
  const sentences: string[] = [];

  if (period.ytd) {
    const finished =
      c <= 0
        ? "No net homes have been finished here so far this year"
        : c < 25 && c < p
          ? `Few homes finished this year (${formatNumber(c)}, ${comparePhrase(c, p, "by this date last year")})`
          : `${homes(c)} finished so far this year, ${comparePhrase(c, p, "by this date last year")}`;
    const pipe = report.pipeline?.total.totalUnits ?? 0;
    const big = report.biggestIssued[0];
    const bigNote =
      big && big.added >= 20 && big.added >= 0.5 * (report.issued.current.totalUnits ?? 0)
        ? `a ${formatNumber(big.added)}-unit building got its permit ${
            big.stage === "issued" && big.stageSince ? `in ${monthName(big.stageSince)}` : "this year"
          }`
        : null;
    if (pipe > 0) {
      sentences.push(`${finished}, ${c < p || c <= 0 ? "but" : "and"} ${unitsCount(pipe)} ${pipe === 1 ? "is" : "are"} in the pipeline.`);
      if (bigNote) sentences.push(`${bigNote.charAt(0).toUpperCase()}${bigNote.slice(1)}.`);
    } else sentences.push(`${finished}${bigNote ? `, and ${bigNote}` : ""}.`);
    const top = largestPipeline.slice(0, 10);
    const stalled = top.filter((r) => r.stalled).length;
    if (top.length >= 3 && stalled > 0)
      sentences.push(`${word(stalled)} of the ${top.length === 10 ? "ten" : word(top.length).toLowerCase()} largest projects in the pipeline ${stalled === 1 ? "is" : "are"} stalled.`);
  } else {
    sentences.push(`${homes(c)} finished in ${period.year}, ${comparePhrase(c, p, `in ${period.year - 1}`)}.`);
    const applied = report.applied.current.totalUnits ?? 0;
    const done = report.outcomes?.completed.totalUnits ?? 0;
    if (applied > 0)
      sentences.push(`${unitsCount(applied)} ${applied === 1 ? "was" : "were"} applied for that year; ${formatNumber(done)} of them ${done === 1 ? "has" : "have"} since been completed.`);
  }
  return sentences.join(" ");
}
