import { HOUSING_TYPE_LABELS, type HousingType } from "@sbt/data/domain/housing-type";
import type { Stage } from "@/lib/filters";

export const formatNumber = (n: number) => n.toLocaleString("en-US");

export const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : "0");

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** "11 Jun 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return parse(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "2 Nov" */
export function formatDayMonth(iso: string): string {
  return parse(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Dec 2024" */
export function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  return parse(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "1 Jan – 21 Nov" (same year) */
export function formatRange(from: string, to: string): string {
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

/** Whole months between two dates. */
export function monthsBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/** "8 mo", "2 yr", "2 yr 5 mo" */
export function formatDuration(from: string | null, to: string): string {
  if (!from) return "—";
  const m = monthsBetween(from, to);
  if (m < 1) {
    const days = Math.max(0, Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000));
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (!y) return `${r} mo`;
  return r ? `${y} yr ${r} mo` : `${y} yr`;
}

export const housingTypeLabel = (t: HousingType | null) => (t ? HOUSING_TYPE_LABELS[t] : "—");

const NOUNS: Record<HousingType, [string, string]> = {
  detached: ["house", "houses"],
  adu: ["ADU", "ADUs"],
  townhouse: ["townhouse", "townhouses"],
  mf_small: ["apartment", "apartments"],
  mf_mid: ["apartment", "apartments"],
  mf_large: ["apartment", "apartments"],
  other: ["home", "homes"],
};

/** "26 apartments", "1 ADU", "3 homes" */
export function unitsNoun(units: number, type: HousingType | null): string {
  const [one, many] = NOUNS[type ?? "other"];
  return `${formatNumber(units)} ${units === 1 ? one : many}`;
}

export const unitsCount = (n: number) => `${formatNumber(n)} ${Math.abs(n) === 1 ? "unit" : "units"}`;
export const homes = (n: number) => `${formatNumber(n)} ${Math.abs(n) === 1 ? "home" : "homes"}`;
export const projectsCount = (n: number) => `${formatNumber(n)} ${n === 1 ? "project" : "projects"}`;

export const STAGE_LABELS: Record<Stage, string> = {
  proposal: "Proposal",
  review: "In review",
  issued: "Issued",
  completed: "Completed",
  expired: "Permit expired",
  dead: "Dead",
};

/** Longer forms for "Where it stands". */
export const STAGE_LONG_LABELS: Record<Stage, string> = {
  proposal: "Proposal, not yet applied",
  review: "In review",
  issued: "Issued, not completed",
  completed: "Completed",
  expired: "Permit expired",
  dead: "Dead (cancelled, withdrawn, denied or expired before issue)",
};

/** "6716 ROOSEVELT WAY NE" → "6716 Roosevelt Way NE". */
export function formatAddress(raw: string | null): string | null {
  if (!raw) return raw;
  return raw
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(Ne|Nw|Se|Sw|N|S|E|W)\b/g, (d) => d.toUpperCase())
    .replace(/\bM L King\b/g, "M L King");
}
