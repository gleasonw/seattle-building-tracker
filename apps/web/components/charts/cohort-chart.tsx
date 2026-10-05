"use client";

import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from "recharts";
import { HOUSING_TYPES } from "@sbt/data/domain/housing-type";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cohortChartConfig } from "@/lib/chart-config";
import { permitsHref, type Filters } from "@/lib/filters";

export interface CohortDatum {
  year: number;
  /** One value per housing type (and "all"); null when withheld by the reliability rule. */
  [series: string]: number | null;
}

/**
 * A measure by application year, one line per housing type plus all types combined.
 * Cohorts still settling are shaded as provisional (SPEC T3). Clicking a year opens the
 * permits behind that cohort.
 */
export function CohortChart({
  data,
  format,
  provisionalFrom,
  drilldown,
  domain,
}: {
  data: CohortDatum[];
  format: "percent" | "days";
  /** First provisional cohort year, if any are shown. */
  provisionalFrom: number | null;
  /** Filters for the cohort's permit list; the chart adds the year. */
  drilldown: Filters;
  domain?: [number, number];
}) {
  const router = useRouter();
  const series = ["all", ...HOUSING_TYPES.filter((t) => data.some((d) => d[t] != null))];
  const fmt = (v: number) => (format === "percent" ? `${Math.round(v * 100)}%` : `${Math.round(v).toLocaleString()}d`);
  const lastYear = data.at(-1)?.year;

  const open = (year: number) => router.push(permitsHref({ ...drilldown, from: `${year}-01-01`, to: `${year}-12-31` }));

  return (
    <ChartContainer config={cohortChartConfig} className="aspect-auto h-80 w-full">
      <LineChart
        data={data}
        margin={{ top: 16, left: 4, right: 12 }}
        className="cursor-pointer"
        onClick={(state) => state?.activeLabel != null && open(Number(state.activeLabel))}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={fmt} domain={domain ?? [0, "auto"]} />
        {provisionalFrom != null && lastYear != null && (
          <ReferenceArea
            x1={provisionalFrom}
            x2={lastYear}
            fill="var(--muted)"
            fillOpacity={0.6}
            label={{ value: "Provisional", position: "insideTop", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
        )}
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const year = payload?.[0]?.payload?.year as number | undefined;
                return year != null && provisionalFrom != null && year >= provisionalFrom ? `${year} (provisional)` : String(year ?? "");
              }}
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{cohortChartConfig[name as keyof typeof cohortChartConfig]?.label}</span>
                  <span className="font-mono tabular-nums">{fmt(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent className="flex-wrap gap-y-1 [&>div]:whitespace-nowrap" />} itemSorter={null} />
        {series.map((s) => (
          <Line
            key={s}
            dataKey={s}
            type="linear"
            stroke={`var(--color-${s})`}
            strokeWidth={s === "all" ? 3 : 1.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
