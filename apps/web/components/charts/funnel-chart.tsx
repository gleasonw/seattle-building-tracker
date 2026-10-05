"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { funnelChartConfig, FUNNEL_SEGMENTS } from "@/lib/chart-config";
import { permitsHref, type Filters } from "@/lib/filters";

export interface FunnelDatum {
  label: string;
  /** Filters reproducing this row in /permits; a segment adds its stage. */
  drilldown: Filters;
  total: number;
  /** Dead units that had been issued, shown in the tooltip. */
  deadAfterIssue: number;
  [segment: string]: number | string | Filters;
}

/**
 * Where applied-for units ended up, per housing type, as shares of the total (SPEC V3):
 * built, still under construction or in review, lapsed after issue, or dead.
 */
export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  const router = useRouter();
  return (
    <ChartContainer config={funnelChartConfig} className="aspect-auto h-96 w-full">
      <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={150} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const d = item.payload as FunnelDatum;
                const units = Number(value);
                const pct = d.total ? Math.round((units / d.total) * 100) : 0;
                const extra = name === "dead" && d.deadAfterIssue ? ` (${d.deadAfterIssue.toLocaleString()} after issue)` : "";
                return (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{funnelChartConfig[name as keyof typeof funnelChartConfig]?.label}</span>
                    <span className="font-mono tabular-nums">
                      {units.toLocaleString()} units · {pct}%{extra}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        {FUNNEL_SEGMENTS.map((s) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="f"
            fill={`var(--color-${s})`}
            className="cursor-pointer"
            onClick={(d: { payload?: FunnelDatum }) => d.payload && router.push(permitsHref({ ...d.payload.drilldown, stage: [s] }))}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
