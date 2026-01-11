"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useFilters } from "@/app/hooks/useFilters";

let exportingInitialized = false;

interface MonthlyData {
  year: number;
  month: number;
  applicationCount: number;
  pipelineCount: number;
  doneCount: number;
  canceledCount: number;
}

interface YearlyData {
  year: number;
  applicationCount: number;
  pipelineCount: number;
  doneCount: number;
  canceledCount: number;
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

export default function ApplicationsChart({ data, startDate, endDate }: Props) {
  const { monthlyData, yearlyData } = data;
  const { updateFilterParams } = useFilters();
  const searchParams = useSearchParams();
  const [exportingReady, setExportingReady] = useState(false);

  // Initialize Highcharts modules
  useEffect(() => {
    if (!exportingInitialized && typeof window !== "undefined") {
      import("highcharts/modules/exporting")
        .then((module) => {
          const initFn = module.default as any;
          if (typeof initFn === "function") {
            initFn(Highcharts);
          }
          return import("highcharts/modules/export-data");
        })
        .then((module) => {
          const initFn = module.default as any;
          if (typeof initFn === "function") {
            initFn(Highcharts);
          }
          exportingInitialized = true;
          setExportingReady(true);
        })
        .catch(() => {
          // Modules failed to load, continue without export functionality
          setExportingReady(true);
        });
    } else {
      setExportingReady(true);
    }
  }, []);

  const monthsDiff = getYearsDifference(startDate, endDate);
  const defaultPeriod = getDefaultPeriod(monthsDiff);

  // Read period from URL, fallback to default
  const period = (searchParams.get("period") as Period) || defaultPeriod;
  const dateField = searchParams.get("dateField") || "completed";

  // Handle click on chart bar to filter by date range
  const handleBarClick = (pointIndex: number) => {
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

      updateFilterParams({ start: startDate, end: endDate });
    } else {
      const yearData = yearlyData[pointIndex];
      const year = yearData.year;

      updateFilterParams({
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        period: "month",
      });
    }
  };

  // Handle range selection
  const handleSelection = (event: any) => {
    if (!event.xAxis || event.xAxis.length === 0) return;

    const minIndex = Math.floor(event.xAxis[0].min);
    const maxIndex = Math.ceil(event.xAxis[0].max);

    if (period === "month") {
      const startMonth = monthlyData[minIndex];
      const endMonth = monthlyData[Math.min(maxIndex, monthlyData.length - 1)];

      if (startMonth && endMonth) {
        const startDate = `${startMonth.year}-${String(
          startMonth.month
        ).padStart(2, "0")}-01`;
        const lastDay = new Date(endMonth.year, endMonth.month, 0).getDate();
        const endDate = `${endMonth.year}-${String(endMonth.month).padStart(
          2,
          "0"
        )}-${String(lastDay).padStart(2, "0")}`;

        updateFilterParams({ start: startDate, end: endDate });
      }
    } else {
      const startYear = yearlyData[minIndex];
      const endYear = yearlyData[Math.min(maxIndex, yearlyData.length - 1)];

      if (startYear && endYear) {
        updateFilterParams({
          start: `${startYear.year}-01-01`,
          end: `${endYear.year}-12-31`,
        });
      }
    }

    return false; // Prevent default zoom behavior
  };

  // Generate time series categories and data based on period
  let categories: string[];
  let pipelineData: number[];
  let doneData: number[];
  let canceledData: number[];

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
    pipelineData = monthlyData.map((d) => d.pipelineCount || 0);
    doneData = monthlyData.map((d) => d.doneCount || 0);
    canceledData = monthlyData.map((d) => d.canceledCount || 0);
  } else {
    categories = yearlyData.map((d) => d.year.toString());
    pipelineData = yearlyData.map((d) => d.pipelineCount || 0);
    doneData = yearlyData.map((d) => d.doneCount || 0);
    canceledData = yearlyData.map((d) => d.canceledCount || 0);
  }

  const series = [
    {
      name: "In Pipeline",
      data: pipelineData.map((value, index) => ({
        y: value,
        events: {
          click: () => handleBarClick(index),
        },
      })),
      color: "#3b82f6",
      cursor: "pointer",
    },
    {
      name: "Done",
      data: doneData.map((value, index) => ({
        y: value,
        events: {
          click: () => handleBarClick(index),
        },
      })),
      color: "#22c55e",
      cursor: "pointer",
    },
    {
      name: "Canceled",
      data: canceledData.map((value, index) => ({
        y: value,
        events: {
          click: () => handleBarClick(index),
        },
      })),
      color: "#9ca3af",
      cursor: "pointer",
    },
  ];

  const chartOptions = {
    chart: {
      type: "column",
      height: 300,
      zoomType: "x" as const,
      events: {
        selection: handleSelection,
      },
    },
    title: {
      text: undefined,
    },
    xAxis: {
      categories,
      title: {
        text: `${
          dateField === "applied"
            ? "Permit Received Date"
            : "Permit Completed Date"
        }`,
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
        text: "Number of Applications",
      },
      min: 0,
      stackLabels: {
        enabled: false,
      },
    },
    plotOptions: {
      column: {
        stacking: "normal" as const,
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
      enabled: true,
    },
    series,
    credits: {
      enabled: false,
    },
    exporting: {
      enabled: true,
      buttons: {
        contextButton: {
          menuItems: [
            "viewFullscreen",
            "separator",
            "downloadPNG",
            "downloadJPEG",
            "downloadPDF",
            "downloadSVG",
            "separator",
            "downloadCSV",
            "downloadXLS",
          ],
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 ">
      <div className="mb-6 flex text-sm items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => updateFilterParams({ period: "month" })}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === "month"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Month
          </button>

          <button
            onClick={() => updateFilterParams({ period: "year" })}
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
