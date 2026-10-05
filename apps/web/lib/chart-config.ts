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

export const totalChartConfig = {
  units: { label: "Units", color: "var(--chart-3)" },
  trailing12: { label: "Trailing 12 months", color: "oklch(0.55 0.14 255)" },
} satisfies ChartConfig;
