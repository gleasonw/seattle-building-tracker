"use client";

import { useRouter } from "next/navigation";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { unitsByYearChartConfig } from "@/lib/chart-config";
import { permitsHref, type Filters, type Milestone } from "@/lib/filters";

export interface YearDatum {
  year: number;
  label: string;
  provisional: boolean;
  /** Units removed, as a negative number; absent when removals aren't counted. */
  removed?: number;
  net?: number;
  [type: string]: number | string | boolean | undefined;
}

/**
 * Units per year stacked by housing type, with removals below zero and a net line when
 * they're counted. Clicking a segment opens the permits behind it.
 */
export function UnitsByYearChart({
  data,
  filters,
  milestone,
  annotations,
}: {
  data: YearDatum[];
  filters: Filters;
  milestone: Milestone;
  annotations: { year: number; label: string }[];
}) {
  const router = useRouter();
  const present = HOUSING_TYPES.filter((t) => data.some((d) => Number(d[t] ?? 0) > 0));
  const hasRemovals = data.some((d) => (d.removed ?? 0) < 0);

  const range = (year: number) => ({ from: `${year}-01-01`, to: `${year}-12-31` });
  const openType = (year: number, type: HousingType) =>
    router.push(permitsHref({ ...filters, on: milestone, ...range(year), type: [type], units: "added" }));
  const openRemoved = (year: number) => router.push(permitsHref({ ...filters, on: milestone, ...range(year), units: "removed" }));

  return (
    <ChartContainer config={unitsByYearChartConfig} className="aspect-auto h-80 w-full">
      <ComposedChart data={data} margin={{ top: 20, left: 4, right: 4 }} stackOffset="sign">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => v.toLocaleString()}
          domain={[(min: number) => Math.min(0, min), "auto"]}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {/* Keep stack order (houses → towers) rather than alphabetical. */}
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        {hasRemovals && <ReferenceLine y={0} stroke="var(--border)" />}
        {annotations.map((a) => (
          <ReferenceLine
            key={`${a.year}-${a.label}`}
            x={data.find((d) => d.year === a.year)?.label}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            label={{ value: a.label, position: "top", fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
          />
        ))}
        {present.map((t, i) => (
          <Bar
            key={t}
            dataKey={t}
            stackId="units"
            fill={`var(--color-${t})`}
            radius={i === present.length - 1 ? [3, 3, 0, 0] : 0}
            className="cursor-pointer"
            onClick={(d: { payload?: YearDatum }) => d.payload && openType(d.payload.year, t)}
          />
        ))}
        {hasRemovals && (
          <Bar
            dataKey="removed"
            stackId="units"
            fill="var(--color-removed)"
            radius={[0, 0, 3, 3]}
            className="cursor-pointer"
            onClick={(d: { payload?: YearDatum }) => d.payload && openRemoved(d.payload.year)}
          />
        )}
        {hasRemovals && (
          <Line dataKey="net" type="monotone" stroke="var(--color-net)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
