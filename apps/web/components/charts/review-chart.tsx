"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HOUSING_TYPE_LABELS, HOUSING_TYPES } from "@sbt/data/domain/housing-type";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reviewChartConfig } from "@/lib/chart-config";
import { permitsHref, type Filters } from "@/lib/filters";

export interface ReviewDatum {
  year: number;
  housingType: string;
  projects: number;
  /** null when withheld by the reliability rule. */
  cityDays: number | null;
  applicantDays: number | null;
  cycles: number | null;
}

const reviewTypeParser = parseAsStringLiteral(["all", ...HOUSING_TYPES] as const).withDefault("all");

/**
 * Median days the City spent reviewing vs. days the applicant spent on corrections, by
 * application year (SPEC M6), for all types or one. The type choice lives in the URL.
 */
export function ReviewChart({ data, drilldown }: { data: ReviewDatum[]; drilldown: Filters }) {
  const router = useRouter();
  const [type, setType] = useQueryState("rt", reviewTypeParser.withOptions({ shallow: true, scroll: false }));
  const rows = data.filter((d) => d.housingType === type);
  const available = new Set(data.map((d) => d.housingType));

  return (
    <div className="flex flex-col gap-3">
      <Select value={type} onValueChange={(v) => void setType(v === "all" ? null : (v as typeof type))}>
        <SelectTrigger size="sm" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All housing types</SelectItem>
          {HOUSING_TYPES.filter((t) => available.has(t)).map((t) => (
            <SelectItem key={t} value={t}>
              {HOUSING_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ChartContainer config={reviewChartConfig} className="aspect-auto h-72 w-full">
        <BarChart
          data={rows}
          margin={{ top: 8, left: 4, right: 12 }}
          className="cursor-pointer"
          onClick={(state) =>
            state?.activeLabel != null &&
            router.push(
              permitsHref({
                ...drilldown,
                from: `${state.activeLabel}-01-01`,
                to: `${state.activeLabel}-12-31`,
                type: type === "all" ? drilldown.type : [type],
              }),
            )
          }
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `${v}d`} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload as ReviewDatum | undefined;
                  if (!d) return "";
                  return `Applied ${d.year} · ${d.projects.toLocaleString()} projects${d.cycles != null ? ` · median ${d.cycles} review cycles` : ""}`;
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="cityDays" stackId="r" fill="var(--color-cityDays)" />
          <Bar dataKey="applicantDays" stackId="r" fill="var(--color-applicantDays)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
