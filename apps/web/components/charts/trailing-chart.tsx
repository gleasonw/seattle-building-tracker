"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { totalChartConfig } from "@/lib/chart-config";

export interface TrailingDatum {
  month: string;
  trailing12: number | null;
}

const monthLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** Trailing 12-month total by month: the seasonally fair "ahead or behind?" view (SPEC §4). */
export function TrailingChart({ data, annotations }: { data: TrailingDatum[]; annotations: { month: string; label: string }[] }) {
  return (
    <ChartContainer config={totalChartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ top: 20, left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={monthLabel} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => v.toLocaleString()} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => monthLabel(String(v))} />} />
        {annotations.map((a) => (
          <ReferenceLine
            key={`${a.month}-${a.label}`}
            x={a.month}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            label={{ value: a.label, position: "top", fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
          />
        ))}
        <Line dataKey="trailing12" type="monotone" stroke="var(--color-trailing12)" strokeWidth={2} dot={false} connectNulls={false} />
      </LineChart>
    </ChartContainer>
  );
}
