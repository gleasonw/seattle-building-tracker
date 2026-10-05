import { HOUSING_TYPE_LABELS, type HousingType } from "@sbt/data/domain/housing-type";

export const formatNumber = (n: number) => n.toLocaleString("en-US");

export function formatPercentChange(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const housingTypeLabel = (t: HousingType | null) => (t ? HOUSING_TYPE_LABELS[t] : "—");

export const STATUS_LABELS: Record<string, string> = {
  pipeline: "Pipeline",
  done: "Done",
  lapsed: "Lapsed",
  dead: "Dead",
};
