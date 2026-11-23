import type { ChartConfig } from "@/components/ui/chart";
import { HOUSING_TYPE_LABELS, HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";

/**
 * One color per housing type, used everywhere a type is drawn. Ordered small → large so
 * stacked bars read as a gradient from houses to towers; "other" is neutral.
 */
export const HOUSING_TYPE_COLORS: Record<HousingType, string> = {
  detached: "oklch(0.58 0.01 56)",
  adu: "oklch(0.74 0.12 55)",
  townhouse: "oklch(0.55 0.13 55)",
  mf_small: "oklch(0.78 0.06 248)",
  mf_mid: "oklch(0.55 0.11 248)",
  mf_large: "oklch(0.34 0.07 255)",
  other: "oklch(0.87 0.005 56)",
};

export const housingTypeChartConfig = Object.fromEntries(
  HOUSING_TYPES.map((t) => [t, { label: HOUSING_TYPE_LABELS[t], color: HOUSING_TYPE_COLORS[t] }]),
) satisfies ChartConfig;

export const longViewChartConfig = {
  units: { label: "Net homes completed", color: "oklch(0.55 0.11 248)" },
  share: { label: "Share of the city's completions", color: "oklch(0.55 0.13 55)" },
} satisfies ChartConfig;
