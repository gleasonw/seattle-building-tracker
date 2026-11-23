"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
/** The smallest round number (1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 × 10ⁿ) at or above v. */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const step = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .map((m) => m * step)
    .find((n) => n >= v)!;
}

/**
 * Axis ranges with both zeros on the same line, so a low share doesn't sit among the negative
 * unit counts (years where demolitions outnumbered completions).
 */
function axes(data: LongViewDatum[], showShare: boolean) {
  const unitsMax = niceCeil(Math.max(1, ...data.map((d) => d.units)));
  const lowest = Math.min(0, ...data.map((d) => d.units));
  const unitsMin = lowest < 0 ? -niceCeil(-lowest) : 0;
  const shares = data
    .map((d) => d.share)
    .filter((v): v is number => v !== null);
  const shareMax =
    showShare && shares.length ? niceCeil(Math.max(...shares)) : 1;
  return {
    units: [unitsMin, unitsMax] as [number, number],
    unitTicks:
      unitsMin < 0
        ? [unitsMin, 0, unitsMax / 2, unitsMax]
        : [0, unitsMax / 2, unitsMax],
    share: [(shareMax * unitsMin) / unitsMax, shareMax] as [number, number],
    shareTicks: [0, shareMax / 2, shareMax],
  };
}

/** Room one year label needs, in pixels. */
const LABEL_WIDTH = 26;

const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(v);

export function LongViewChart({
  data,
  showShare,
}: {
  data: LongViewDatum[];
  showShare: boolean;
}) {
  const router = useRouter();
  const hasNegative = data.some((d) => d.units < 0);
  const domain = axes(data, showShare);
  // Label every year when there's room, else every second or third counting back from this
  // year, so the labels stay evenly spaced and this year always has one.
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry!.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const step = width
    ? Math.max(1, Math.ceil((data.length * LABEL_WIDTH) / (width - 90)))
    : 1;
  const xTicks = data
    .filter((_, i) => (data.length - 1 - i) % step === 0)
    .map((d) => d.label);
  return (
    <div ref={ref}>
      <ChartContainer
        config={longViewChartConfig}
        className="aspect-auto h-64 w-full sm:h-72"
      >
        <ComposedChart
          data={data}
          margin={{ top: 24, left: 0, right: showShare ? 0 : 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            ticks={xTicks}
            interval={0}
            fontSize={11}
          />
          <YAxis
            yAxisId="units"
            tickLine={false}
            axisLine={false}
            width={44}
            fontSize={11}
            domain={domain.units}
            ticks={domain.unitTicks}
            allowDataOverflow
            tickFormatter={compact}
          />
          {showShare && (
            <YAxis
              yAxisId="share"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={40}
              fontSize={11}
              domain={domain.share}
              ticks={domain.shareTicks}
              allowDataOverflow
              tickFormatter={(v: number) => `${Number(v.toFixed(1))}%`}
            />
          )}
          {hasNegative && (
            <ReferenceLine yAxisId="units" y={0} stroke="var(--border)" />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload as LongViewDatum | undefined;
                  return d
                    ? d.provisional
                      ? `${d.year}, year to date`
                      : String(d.year)
                    : null;
                }}
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {longViewChartConfig[name as "units" | "share"]?.label}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {name === "share"
                        ? `${Number(value).toFixed(1)}%`
                        : Number(value).toLocaleString()}
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
            onClick={(d: { payload?: LongViewDatum }) =>
              d.payload && router.push(d.payload.href)
            }
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
    </div>
  );
}
