"use client";

import { useState, useEffect } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { Calendar } from "lucide-react";

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

interface Props {
  data: {
    monthlyData: MonthlyData[];
    quarterlyData: QuarterlyData[];
    yearlyData: YearlyData[];
  };
  startDate?: string;
  endDate?: string;
}

type Period = "month" | "quarter" | "year";

function getMonthsDifference(start?: string, end?: string): number | null {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

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
  const { monthlyData, quarterlyData, yearlyData } = data;

  const monthsDiff = getMonthsDifference(startDate, endDate);
  const defaultPeriod = getDefaultPeriod(monthsDiff);

  const [period, setPeriod] = useState<Period>(defaultPeriod);

  // Update period when date range changes
  useEffect(() => {
    setPeriod(defaultPeriod);
  }, [defaultPeriod]);

  // Hide chart if date range is less than 2 months
  if (monthsDiff !== null && monthsDiff < 2) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-gray-500 max-w-md">
            Please select a date range of at least 2 months to view the chart.
          </p>
        </div>
      </div>
    );
  }

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
    seriesData = monthlyData.map((d) => d.applicationCount || 0);
  } else if (period === "quarter") {
    categories = quarterlyData.map((d) => `Q${d.quarter} ${d.year}`);
    seriesData = quarterlyData.map((d) => d.applicationCount || 0);
  } else {
    categories = yearlyData.map((d) => d.year.toString());
    seriesData = yearlyData.map((d) => d.applicationCount || 0);
  }

  const series = [
    {
      name: "Applications Submitted",
      data: seriesData,
      color: "#3b82f6",
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
        text:
          period === "month"
            ? "Month"
            : period === "quarter"
            ? "Quarter"
            : "Year",
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
      <div className="mb-6 flex items-center gap-4">
        <label className="font-medium text-gray-700">Period:</label>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod("month")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === "month"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setPeriod("quarter")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === "quarter"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Quarter
          </button>
          <button
            onClick={() => setPeriod("year")}
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

      <div className="bg-gray-50 rounded-lg p-6">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>
    </div>
  );
}
