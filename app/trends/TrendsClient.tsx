"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import GeographicSearch from "../components/GeographicSearch";
import TrendsChart from "./TrendsChart";
import RecordsTable from "./RecordsTable";
import FilterDisplay from "./FilterDisplay";

interface MonthlyUnitsData {
  year: number;
  month: number;
  totalUnitsAdded: number;
}

interface QuarterlyUnitsData {
  year: number;
  quarter: number;
  totalUnitsAdded: number;
}

interface YearlyUnitsData {
  year: number;
  totalUnitsAdded: number;
}

interface MonthlyApplicationsData {
  year: number;
  month: number;
  applicationCount: number;
}

interface QuarterlyApplicationsData {
  year: number;
  quarter: number;
  applicationCount: number;
}

interface YearlyApplicationsData {
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
    unitsData: {
      monthlyData: MonthlyUnitsData[];
      quarterlyData: QuarterlyUnitsData[];
      yearlyData: YearlyUnitsData[];
    };
    applicationsData: {
      monthlyData: MonthlyApplicationsData[];
      quarterlyData: QuarterlyApplicationsData[];
      yearlyData: YearlyApplicationsData[];
    };
  };
  records: Record[];
  initialParams: {
    start?: string;
    end?: string;
    dateType?: "completed" | "applied";
    sortBy?: string;
    sortOrder?: string;
    address?: string;
    radius?: string;
    lat?: string;
    lng?: string;
    metric?: "units" | "applications";
  };
}

export default function TrendsClient({
  trendsData,
  records,
  initialParams,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [startDate, setStartDate] = useState(initialParams.start || "");
  const [endDate, setEndDate] = useState(initialParams.end || "");
  const [dateType, setDateType] = useState<"completed" | "applied">(
    initialParams.dateType || "completed"
  );
  const [metric, setMetric] = useState<"units" | "applications">(
    initialParams.metric || "units"
  );

  const handleFilterChange = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    router.push(`/trends?${newParams.toString()}`);
  };

  const handleApplyDateFilter = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (startDate) {
      newParams.set("start", startDate);
    } else {
      newParams.delete("start");
    }
    if (endDate) {
      newParams.set("end", endDate);
    } else {
      newParams.delete("end");
    }
    newParams.set("dateType", dateType);
    router.push(`/trends?${newParams.toString()}`);
  };

  const handleMetricChange = (newMetric: "units" | "applications") => {
    setMetric(newMetric);
    handleFilterChange("metric", newMetric);
  };

  // Create Seattle Open Data Portal URL with filters
  const createSeattleDataUrl = () => {
    const baseUrl =
      "https://data.seattle.gov/Built-Environment/Building-Permits/76t5-zqzr/explore/query";

    const conditions = [
      "(`permittypemapped` IN ('Building', 'Demolition', 'Land Use'))",
      "`applieddate` IS NOT NULL",
      "`housingunitsadded` > 0",
    ];

    const dateField = dateType === "completed" ? "completeddate" : "applieddate";

    if (startDate) {
      conditions.push(`\`${dateField}\` >= '${startDate}T00:00:00'`);
    }
    if (endDate) {
      conditions.push(`\`${dateField}\` <= '${endDate}T23:59:59'`);
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
      {/* Geographic Search */}
      <GeographicSearch />

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="font-semibold mb-3">Time Range Filter</h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Type
              </label>
              <select
                value={dateType}
                onChange={(e) =>
                  setDateType(e.target.value as "completed" | "applied")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="completed">Completed Date</option>
                <option value="applied">Applied Date</option>
              </select>
            </div>
            <button
              onClick={handleApplyDateFilter}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      <FilterDisplay
        params={initialParams}
        onRemoveFilter={(key) => handleFilterChange(key, null)}
      />

      {/* Metric Toggle */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="font-semibold mb-3">Metric</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleMetricChange("units")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              metric === "units"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Housing Units Added
          </button>
          <button
            onClick={() => handleMetricChange("applications")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              metric === "applications"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Permit Applications
          </button>
        </div>
      </div>

      {/* Chart */}
      <TrendsChart
        data={metric === "units" ? trendsData.unitsData : trendsData.applicationsData}
        metric={metric}
      />

      {/* Records Table */}
      <div className="mt-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Building Permit Records</h2>
          <a
            href={seattleDataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View in Seattle Open Data Portal →
          </a>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          {records.length} record{records.length !== 1 ? "s" : ""} found
        </div>
      </div>

      <RecordsTable records={records} initialParams={initialParams} />
    </>
  );
}
