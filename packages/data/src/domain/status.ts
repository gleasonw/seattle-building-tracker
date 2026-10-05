/**
 * Status categories and lifecycle stages (SPEC §3).
 *
 * Every City status value must be listed here. An unknown value fails the sync run
 * rather than being silently treated as pipeline.
 */

export const STATUS_CATEGORIES = ["pipeline", "done", "lapsed", "dead"] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const STAGES = ["pre_intake", "applied", "issued", "done", "lapsed", "dead"] as const;
export type Stage = (typeof STAGES)[number];

/** Pipeline stages in lifecycle order. */
export const PIPELINE_STAGES = ["pre_intake", "applied", "issued"] as const satisfies readonly Stage[];

/** City status values per category, for display on the methodology page. */
export const STATUS_VALUES = {
  done: ["Completed", "Closed", "Approved to Occupy", "Inspections Completed"],
  dead: ["Canceled", "Withdrawn", "Denied"],
  /** Lapsed if the permit was issued, otherwise dead. */
  expired: ["Expired"],
  pipeline: [
    "Active",
    "Additional Info Requested",
    "Application Completed",
    "Awaiting Information",
    "Corrections Required",
    "Corrections Submitted",
    "Initiated",
    "Issued",
    "Pending",
    "Phase Issued",
    "Ready for Intake",
    "Ready for Issuance",
    "Reviews Completed",
    "Reviews In Process",
    "Scheduled",
    "Scheduled and Submitted",
  ],
} as const;

const lower = (values: readonly string[]) => new Set(values.map((v) => v.toLowerCase()));
const DONE = lower(STATUS_VALUES.done);
const DEAD = lower(STATUS_VALUES.dead);
const EXPIRED = "expired";
const ISSUED = lower(["Issued", "Phase Issued"]);
const PIPELINE = lower(STATUS_VALUES.pipeline);

export class UnknownStatusError extends Error {
  constructor(public readonly status: string) {
    super(`Unknown permit status "${status}". Add it to domain/status.ts.`);
  }
}

export function isKnownStatus(status: string | null): boolean {
  if (status === null) return true;
  const s = status.toLowerCase();
  return DONE.has(s) || DEAD.has(s) || s === EXPIRED || PIPELINE.has(s);
}

export function classifyStatus(input: {
  statusCurrent: string | null;
  appliedDate: string | null;
  issuedDate: string | null;
}): { statusCategory: StatusCategory; stage: Stage } {
  const s = input.statusCurrent?.toLowerCase() ?? null;

  if (s !== null && DONE.has(s)) return { statusCategory: "done", stage: "done" };
  if (s !== null && DEAD.has(s)) return { statusCategory: "dead", stage: "dead" };
  if (s === EXPIRED) {
    // Issued then expired: outcome unknown (SPEC §3 "Lapsed"). Never issued: dead.
    return input.issuedDate
      ? { statusCategory: "lapsed", stage: "lapsed" }
      : { statusCategory: "dead", stage: "dead" };
  }
  if (s !== null && !PIPELINE.has(s)) throw new UnknownStatusError(input.statusCurrent!);

  if (!input.appliedDate) return { statusCategory: "pipeline", stage: "pre_intake" };
  if (input.issuedDate || (s !== null && ISSUED.has(s))) {
    return { statusCategory: "pipeline", stage: "issued" };
  }
  return { statusCategory: "pipeline", stage: "applied" };
}
