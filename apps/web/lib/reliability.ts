/**
 * The reliability rule (SPEC T2). Applied here and nowhere else.
 *
 * - Every total shows how many projects are behind it.
 * - If one project makes up more than half of a total, the total says so and names it.
 * - Percent changes and shares are hidden below MIN_PROJECTS projects.
 */
import { formatNumber } from "@/lib/format";

/** Minimum projects behind a percent change or share (SPEC open question 3). */
export const MIN_PROJECTS = 10;

/** Share of units from one project above which a total is flagged as concentrated. */
export const CONCENTRATION_THRESHOLD = 0.5;

export interface Support {
  projectCount: number;
  permitCount: number;
  /** Units from the single largest project, and that project's address. */
  topProjectUnits?: number;
  topProjectLabel?: string | null;
  /** Signed total (net when removals are included). */
  totalUnits?: number;
  addedUnits?: number;
  removedUnits?: number;
}

/** The largest project's share of the gross units (added plus removed) behind a total. */
export function topShare(support: Support): number {
  const gross = (support.addedUnits ?? support.totalUnits ?? 0) + (support.removedUnits ?? 0);
  if (!gross || !support.topProjectUnits) return 0;
  return support.topProjectUnits / gross;
}

/** Whether a percent change or share may be shown. */
export function canDerive(...supports: Support[]): boolean {
  return supports.every((s) => s.projectCount >= MIN_PROJECTS);
}

/** "One project (6716 Roosevelt Way NE) is 131 of them", or null. */
export function concentrationNote(support: Support): string | null {
  if (support.projectCount < 2 || topShare(support) <= CONCENTRATION_THRESHOLD) return null;
  const where = support.topProjectLabel ? ` (${support.topProjectLabel})` : "";
  return `One project${where} is ${formatNumber(support.topProjectUnits ?? 0)} of them`;
}
