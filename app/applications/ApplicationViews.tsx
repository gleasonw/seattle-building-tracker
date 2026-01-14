"use client";

import ApplicationsChart from "@/app/applications/ApplicationsChart";
import { ConstructionChart } from "@/app/components/ConstructionChart";
import dynamic from "next/dynamic";
import { useFilters } from "@/app/hooks/useFilters";

const UnifiedMap = dynamic(() => import("@/app/components/UnifiedMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow p-6 h-[500px] flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

interface MonthlyApplicationData {
  year: number;
  month: number;
  applicationCount: number;
  pipelineCount: number;
  doneCount: number;
  canceledCount: number;
}

interface YearlyApplicationData {
  year: number;
  applicationCount: number;
  pipelineCount: number;
  doneCount: number;
  canceledCount: number;
}

interface MonthlyConstructionData {
  year: number;
  month: number;
  totalUnitsAdded: number;
}

interface YearlyConstructionData {
  year: number;
  totalUnitsAdded: number;
}

interface Record {
  latitude: string | null;
  longitude: string | null;
  originalAddress1: string | null;
  permitNum: string;
  appliedDate: string | null;
  completedDate: string | null;
  statusCurrent: string | null;
  housingUnitsAdded: number | null;
  link: string | null;
}

interface Cluster {
  neighborhood: string | null;
  count: number;
  centerLat: number;
  centerLng: number;
  pipelineCount: number;
  doneCount: number;
  canceledCount: number;
}

interface ApplicationViewsProps {
  applicationTrends: {
    monthlyData: MonthlyApplicationData[];
    yearlyData: YearlyApplicationData[];
  };
  constructionTrends: {
    monthlyData: MonthlyConstructionData[];
    yearlyData: YearlyConstructionData[];
  };
  records?: Record[];
  clusters?: Cluster[];
  isCluster?: boolean;
  startDate?: string;
  endDate?: string;
  extra?: React.ReactNode;
}

export default function ApplicationViews({
  applicationTrends,
  constructionTrends,
  records,
  clusters,
  isCluster,
  startDate,
  endDate,
  extra,
}: ApplicationViewsProps) {
  const { getDateField } = useFilters();
  const dateField = getDateField();
  return (
    <div className="space-y-6 mb-6">
      {/* Charts - Side by side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {dateField === "applied"
              ? "Applied for Housing Units"
              : "Completed Housing Units"}
          </h2>
          <ConstructionChart
            data={constructionTrends}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Total Permits
          </h2>
          <ApplicationsChart
            data={applicationTrends}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      </div>

      {/* Map - Full width beneath charts */}
      <div>
        {extra}

        <UnifiedMap
          records={records}
          clusters={clusters}
          isCluster={isCluster}
        />
      </div>
    </div>
  );
}
