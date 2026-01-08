"use client";

import { useRouter } from "next/navigation";

interface YearStats {
  currentYear: number;
  previousYear: number;
  currentTotal: number;
  previousTotal: number;
  percentChange: number;
  applicationsThisYear: number;
  applicationsPreviousYear: number;
  applicationsPercentChange: number;
}

interface Permit {
  permitNum: string;
  completedDate: string | null;
  housingUnitsAdded: number | null;
  originalAddress1: string | null;
  permitTypeMapped: string | null;
  description: string | null;
  link: string | null;
}

interface Props {
  selectedYear: number;
  availableYears: number[];
  stats: YearStats;
  permits: Permit[];
}

export default function YearProgressView({
  selectedYear,
  availableYears,
  stats,
  permits,
}: Props) {
  const router = useRouter();

  const handleYearChange = (year: number) => {
    router.push(`/?year=${year}`);
  };

  return (
    <>
      {/* Year Stats Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {selectedYear} Housing Progress
          </h2>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Select Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">
              Units Completed in {selectedYear}
            </div>
            <div className="text-3xl font-bold">
              {stats.currentTotal.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">
              Previous Year ({stats.previousYear})
            </div>
            <div className="text-3xl font-bold text-gray-500">
              {stats.previousTotal.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Year-over-Year</div>
            <div
              className={`text-3xl font-bold ${
                stats.percentChange >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {stats.percentChange >= 0 ? "+" : ""}
              {stats.percentChange.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
          <div>
            <div className="text-sm text-gray-600 mb-1">
              Applications in {selectedYear}
            </div>
            <div className="text-2xl font-bold">
              {stats.applicationsThisYear.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">
              Previous Year ({stats.previousYear})
            </div>
            <div className="text-2xl font-bold text-gray-500">
              {stats.applicationsPreviousYear.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Applications YoY</div>
            <div
              className={`text-2xl font-bold ${
                stats.applicationsPercentChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {stats.applicationsPercentChange >= 0 ? "+" : ""}
              {stats.applicationsPercentChange.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 Permits */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold">
            Top 10 Projects Completed in {selectedYear}
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="text-left p-4 font-semibold text-sm">Rank</th>
              <th className="text-left p-4 font-semibold text-sm">
                Permit Number
              </th>
              <th className="text-left p-4 font-semibold text-sm">
                Completed Date
              </th>
              <th className="text-left p-4 font-semibold text-sm">Address</th>
              <th className="text-right p-4 font-semibold text-sm">
                Housing Units
              </th>
            </tr>
          </thead>
          <tbody>
            {permits.length > 0 ? (
              permits.map((permit, idx) => (
                <tr
                  key={permit.permitNum}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="p-4 text-sm text-gray-600">{idx + 1}</td>
                  <td className="p-4 text-sm">
                    {permit.link ? (
                      <a
                        href={permit.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {permit.permitNum}
                      </a>
                    ) : (
                      <span className="font-mono text-gray-900">
                        {permit.permitNum}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {permit.completedDate
                      ? new Date(permit.completedDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="p-4 text-sm max-w-md">
                    <div className="truncate">
                      {permit.originalAddress1 ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            permit.originalAddress1 + ", Seattle, WA"
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {permit.originalAddress1}
                        </a>
                      ) : (
                        "-"
                      )}
                    </div>
                    {permit.description && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {permit.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-right tabular-nums font-medium">
                    {permit.housingUnitsAdded?.toLocaleString() || 0}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No completed projects in {selectedYear}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
