/**
 * The reliability rule (SPEC T2). Applied here and nowhere else.
 *
 * - Every aggregate shows how many projects are behind it.
 * - If one project makes up more than half the units, the number is flagged.
 * - Derived numbers (percent changes, medians, shares, ranks) are withheld below N projects.
 */

/** Minimum projects behind a derived number. Provisional; calibrate against real data (SPEC open question 3). */
export const MIN_PROJECTS = 10;

/** Share of units from one project above which a total is flagged as concentrated. */
export const CONCENTRATION_THRESHOLD = 0.5;

export type Reliability = "ok" | "concentrated" | "insufficient";

export interface Support {
  projectCount: number;
  permitCount: number;
  /** Units from the single largest project, and which project that is. */
  topProjectUnits?: number;
  topProjectLabel?: string | null;
  totalUnits?: number;
}

export function grade(support: Support): Reliability {
  if (support.projectCount < MIN_PROJECTS) return "insufficient";
  if (topShare(support) > CONCENTRATION_THRESHOLD) return "concentrated";
  return "ok";
}

export function topShare(support: Support): number {
  if (!support.totalUnits || !support.topProjectUnits) return 0;
  return support.topProjectUnits / support.totalUnits;
}

/** Whether a derived number (change, median, share, rank) may be shown. */
export function canDerive(...supports: Support[]): boolean {
  return supports.every((s) => s.projectCount >= MIN_PROJECTS);
}

export function explain(support: Support): string {
  const base = `Based on ${support.projectCount.toLocaleString()} ${support.projectCount === 1 ? "project" : "projects"} (${support.permitCount.toLocaleString()} permits).`;
  const r = grade(support);
  if (r === "insufficient") {
    return `${base} Fewer than ${MIN_PROJECTS} projects, so changes, medians and rankings aren't computed.`;
  }
  if (r === "concentrated") {
    const pct = Math.round(topShare(support) * 100);
    return `${base} One project${support.topProjectLabel ? ` (${support.topProjectLabel})` : ""} makes up ${pct}% of the units, so this total mostly reflects a single development.`;
  }
  return base;
}
