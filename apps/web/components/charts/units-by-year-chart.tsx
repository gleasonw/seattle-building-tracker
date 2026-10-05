"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { housingTypeChartConfig } from "@/lib/chart-config";
import { permitsHref, type Filters, type Milestone } from "@/lib/filters";

export interface YearDatum {
  year: number;
  label: string;
  provisional: boolean;
  [type: string]: number | string | boolean;
}

/** Units per year stacked by housing type. Clicking a segment opens the permits behind it. */
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

  const open = (year: number, type: HousingType) =>
    router.push(permitsHref({ ...filters, on: milestone, from: `${year}-01-01`, to: `${year}-12-31`, type: [type] }));

  return (
    <ChartContainer config={housingTypeChartConfig} className="aspect-auto h-80 w-full">
      <BarChart data={data} margin={{ top: 20, left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => v.toLocaleString()} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {/* Keep stack order (houses → towers) rather than alphabetical. */}
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
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
            onClick={(d: { payload?: YearDatum }) => d.payload && open(d.payload.year, t)}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
