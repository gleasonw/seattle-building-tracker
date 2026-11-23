"use client";

import { useRouter } from "next/navigation";
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { longViewChartConfig } from "@/lib/chart-config";

export interface LongViewDatum {
  year: number;
  label: string;
  units: number;
  /** Place's share of the city's completions, 0–100, or null when hidden (SPEC T2). */
  share: number | null;
  href: string;
  provisional: boolean;
  /** Policy marker numbers for this year, e.g. "1, 2". */
  marker?: string;
}

/**
 * Net homes completed per year (SPEC P1 §6, P3 §4). This year is outlined as year to date;
 * numbered markers point to policy changes listed under the chart. Clicking a bar opens its
 * projects.
 */
export function LongViewChart({ data, showShare }: { data: LongViewDatum[]; showShare: boolean }) {
  const router = useRouter();
  const hasNegative = data.some((d) => d.units < 0);
  return (
    <ChartContainer config={longViewChartConfig} className="aspect-auto h-64 w-full sm:h-72">
      <ComposedChart data={data} margin={{ top: 24, left: 0, right: showShare ? 0 : 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={4} fontSize={11} />
        <YAxis
          yAxisId="units"
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={11}
          tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(v))}
        />
        {showShare && (
          <YAxis
            yAxisId="share"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={40}
            fontSize={11}
            tickFormatter={(v: number) => `${v}%`}
          />
        )}
        {hasNegative && <ReferenceLine yAxisId="units" y={0} stroke="var(--border)" />}
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{longViewChartConfig[name as "units" | "share"]?.label}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {name === "share" ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString()}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          yAxisId="units"
          dataKey="units"
          radius={[4, 4, 0, 0]}
          className="cursor-pointer"
          onClick={(d: { payload?: LongViewDatum }) => d.payload && router.push(d.payload.href)}
        >
          {data.map((d) => (
            <Cell
              key={d.year}
              fill={d.provisional ? "var(--card)" : "var(--color-units)"}
              stroke="var(--color-units)"
              strokeWidth={d.provisional ? 2 : 0}
              strokeDasharray={d.provisional ? "5 3" : undefined}
            />
          ))}
          <LabelList
            dataKey="marker"
            position="top"
            offset={8}
            className="fill-trend-down"
            fontSize={12}
            fontWeight={700}
          />
        </Bar>
        {showShare && (
          <Line
            yAxisId="share"
            dataKey="share"
            type="monotone"
            stroke="var(--color-share)"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls={false}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
