"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

interface MonthlyData {
  year: number;
  month: number;
  totalUnitsAdded: number;
}

interface YearlyData {
  year: number;
  totalUnitsAdded: number;
}

interface Props {
  data: {
    monthlyData: MonthlyData[];
    yearlyData: YearlyData[];
  };
  startDate?: string;
  endDate?: string;
}

type Period = "month" | "year";

function getYearsDifference(start?: string, end?: string): number | null {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  // Calculate months to ensure at least 2 months difference
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  return months;
}

function getDefaultPeriod(monthsDiff: number | null): Period {
  if (monthsDiff === null) return "year";
  if (monthsDiff < 12) return "month";
  return "year";
}

export default function ConstructionChart({ data, startDate, endDate }: Props) {
  const { monthlyData, yearlyData } = data;
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthsDiff = getYearsDifference(startDate, endDate);
  const defaultPeriod = getDefaultPeriod(monthsDiff);

  // Read period from URL, fallback to default
  const period = (searchParams.get("period") as Period) || defaultPeriod;

  // Handle click on chart bar to filter by date range
  const handleBarClick = (pointIndex: number) => {
    const newParams = new URLSearchParams(searchParams.toString());

    if (period === "month") {
      const monthData = monthlyData[pointIndex];
      const year = monthData.year;
      const month = monthData.month;

      // Set start to first day of month, end to last day of month
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
        lastDay
      ).padStart(2, "0")}`;

      newParams.set("start", startDate);
      newParams.set("end", endDate);
    } else {
      const yearData = yearlyData[pointIndex];
      const year = yearData.year;

      newParams.set("start", `${year}-01-01`);
      newParams.set("end", `${year}-12-31`);
      newParams.set("period", "month");
    }

    router.push(`/construction?${newParams.toString()}`, { scroll: false });
  };

  // Generate time series categories and data based on period
  let categories: string[];
  let seriesData: number[];

  if (period === "month") {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    categories = monthlyData.map((d) => `${monthNames[d.month - 1]} ${d.year}`);
    seriesData = monthlyData.map((d) => d.totalUnitsAdded || 0);
  } else {
    categories = yearlyData.map((d) => d.year.toString());
    seriesData = yearlyData.map((d) => d.totalUnitsAdded || 0);
  }

  const series = [
    {
      name: "Housing Units Completed",
      data: seriesData.map((value, index) => ({
        y: value,
        events: {
          click: () => handleBarClick(index),
        },
      })),
      color: "#3b82f6",
      cursor: "pointer",
    },
  ];

  const chartOptions = {
    chart: {
      type: "column",
      height: 500,
    },
    title: {
      text: undefined,
    },
    xAxis: {
      categories,
      title: {
        text: period === "month" ? "Month" : "Year",
      },
      labels: {
        rotation: period === "month" ? -45 : 0,
        style: {
          fontSize: "11px",
        },
      },
    },
    yAxis: {
      title: {
        text: "Housing Units Completed",
      },
      min: 0,
    },
    plotOptions: {
      column: {
        grouping: false,
        shadow: false,
        borderWidth: 0,
      },
    },
    tooltip: {
      shared: true,
      crosshairs: true,
    },
    legend: {
      enabled: false,
    },
    series,
    credits: {
      enabled: false,
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="mb-6 flex text-sm items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.set("period", "month");
              router.push(`/construction?${newParams.toString()}`, {
                scroll: false,
              });
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === "month"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.set("period", "year");
              router.push(`/construction?${newParams.toString()}`, {
                scroll: false,
              });
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === "year"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Year
          </button>
        </div>
      </div>

      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
    </div>
  );
}
