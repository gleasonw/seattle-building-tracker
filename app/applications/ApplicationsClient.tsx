"use client";

import ApplicationsChart from "./ApplicationsChart";
import RecordsTable from "../components/RecordsTable";
import {
  BuildingDashSearchParams,
  PermitRowFilters,
} from "@/app/PermitRowFilters";

interface MonthlyData {
  year: number;
  month: number;
  applicationCount: number;
}

interface QuarterlyData {
  year: number;
  quarter: number;
  applicationCount: number;
}

interface YearlyData {
  year: number;
  applicationCount: number;
}

interface Record {
  permitNum: string;
  appliedDate: string | null;
  completedDate: string | null;
  housingUnitsAdded: number | null;
  originalAddress1: string | null;
  permitTypeMapped: string | null;
  description: string | null;
  link: string | null;
  estProjectCost: string | null;
  latitude: string | null;
  longitude: string | null;
}

interface Props {
  trendsData: {
    monthlyData: MonthlyData[];
    quarterlyData: QuarterlyData[];
    yearlyData: YearlyData[];
  };
  records: Record[];
  initialParams: BuildingDashSearchParams;
}

export default function ApplicationsClient({
  trendsData,
  records,
  initialParams,
}: Props) {
  // Create Seattle Open Data Portal URL with filters
  const createSeattleDataUrl = () => {
    const baseUrl =
      "https://data.seattle.gov/Built-Environment/Building-Permits/76t5-zqzr/explore/query";

    const conditions = [
      "(`permittypemapped` IN ('Building', 'Demolition', 'Land Use'))",
      "`applieddate` IS NOT NULL",
      "`housingunitsadded` > 0",
    ];

    const dateField = "applieddate";

    if (initialParams.start) {
      conditions.push(`\`${dateField}\` >= '${initialParams.start}T00:00:00'`);
    }
    if (initialParams.end) {
      conditions.push(`\`${dateField}\` <= '${initialParams.end}T23:59:59'`);
    }

    const whereClause = conditions.join(" AND ");

    const sqlQuery = `SELECT
  *
WHERE ${whereClause}
ORDER BY \`${dateField}\` DESC`;

    return `${baseUrl}/${encodeURIComponent(sqlQuery)}/page/filter`;
  };

  const seattleDataUrl = createSeattleDataUrl();

  return (
    <>
      <PermitRowFilters initialParams={initialParams} />
      <ApplicationsChart
        data={trendsData}
        startDate={initialParams.start}
        endDate={initialParams.end}
      />

      <RecordsTable
        records={records}
        initialParams={initialParams}
        seattleDataUrl={seattleDataUrl}
        extraFields={[{ key: "statusCurrent", label: "Current Status" }]}
      />
    </>
  );
}
