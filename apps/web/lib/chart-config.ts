import type { ChartConfig } from "@/components/ui/chart";
import { HOUSING_TYPE_LABELS, HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";

/**
 * One color per housing type, used by every chart. Ordered small → large so stacked bars
 * read as a gradient from houses to towers; "other" is neutral.
 */
const HOUSING_TYPE_COLORS: Record<HousingType, string> = {
  detached: "oklch(0.72 0.12 75)",
  adu: "oklch(0.78 0.14 120)",
  townhouse: "oklch(0.68 0.13 160)",
  mf_small: "oklch(0.66 0.11 220)",
  mf_mid: "oklch(0.55 0.14 255)",
  mf_large: "oklch(0.42 0.14 275)",
  other: "oklch(0.75 0 0)",
};

export const housingTypeChartConfig = Object.fromEntries(
  HOUSING_TYPES.map((t) => [t, { label: HOUSING_TYPE_LABELS[t], color: HOUSING_TYPE_COLORS[t] }]),
) satisfies ChartConfig;

export const unitsByYearChartConfig = {
  ...housingTypeChartConfig,
  removed: { label: "Removed (demolished)", color: "oklch(0.64 0.19 25)" },
  net: { label: "Net", color: "var(--foreground)" },
} satisfies ChartConfig;

export const totalChartConfig = {
  units: { label: "Units", color: "var(--chart-3)" },
  trailing12: { label: "Net units, trailing 12 months", color: "oklch(0.55 0.14 255)" },
} satisfies ChartConfig;

/** Funnel segments in lifecycle order: built, still moving, then lost. */
export const FUNNEL_SEGMENTS = ["done", "issued", "applied", "lapsed", "dead"] as const;

export const funnelChartConfig = {
  done: { label: "Built", color: "oklch(0.55 0.14 255)" },
  issued: { label: "Issued, not completed", color: "oklch(0.72 0.1 240)" },
  applied: { label: "Still in review", color: "oklch(0.85 0.05 240)" },
  lapsed: { label: "Lapsed after issue", color: "oklch(0.78 0.13 75)" },
  dead: { label: "Dead (cancelled, withdrawn, denied)", color: "oklch(0.64 0.19 25)" },
} satisfies ChartConfig;

export const cohortChartConfig = {
  all: { label: "All types", color: "var(--foreground)" },
  ...housingTypeChartConfig,
} satisfies ChartConfig;

export const reviewChartConfig = {
  cityDays: { label: "City reviewing", color: "oklch(0.55 0.14 255)" },
  applicantDays: { label: "Applicant making corrections", color: "oklch(0.78 0.13 75)" },
} satisfies ChartConfig;
