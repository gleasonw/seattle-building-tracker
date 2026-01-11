"use client";

import ApplicationsChart from "@/app/applications/ApplicationsChart";
import { ConstructionChart } from "@/app/components/ConstructionChart";
import dynamic from "next/dynamic";

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
  records: Record[];
  startDate?: string;
  endDate?: string;
}

export default function ApplicationViews({
  applicationTrends,
  constructionTrends,
  records,
  startDate,
  endDate,
}: ApplicationViewsProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 mb-6">
      {/* Map - Top on mobile, Right on desktop */}
      <div className="order-1 lg:order-2 lg:flex-1">
        <UnifiedMap records={records} />
      </div>

      {/* Charts - Stacked vertically, Below map on mobile, Left on desktop */}
      <div className="order-2 lg:order-1 lg:flex-1 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Housing Units Added
          </h2>
          <ConstructionChart
            data={constructionTrends}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Applications Submitted
          </h2>
          <ApplicationsChart
            data={applicationTrends}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      </div>
    </div>
  );
}
