import { db } from "@/server/src/db";
import { and, desc, isNotNull, sql } from "drizzle-orm";
import { buildingPermits } from "@/server/src/db/schema";
import Link from "next/link";
import DashboardNav from "./components/DashboardNav";
import DataFooter from "./components/DataFooter";

async function getYearStats(year: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Housing units completed this year
  const housingUnitsCompleted = await db
    .select({
      total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(
      and(
        sql`${buildingPermits.completedDate} >= ${yearStart}`,
        sql`${buildingPermits.completedDate} <= ${yearEnd}`
      )
    );

  // Permits applied this year
  const permitsApplied = await db
    .select({
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(
      and(
        sql`${buildingPermits.appliedDate} >= ${yearStart}`,
        sql`${buildingPermits.appliedDate} <= ${yearEnd}`,
        sql`${buildingPermits.housingUnitsAdded} > 0`
      )
    );

  // Get YTD stats if current year
  const now = new Date();
  const currentYear = now.getFullYear();
  let ytdStats = null;

  if (year === currentYear) {
    const ytdDate = now.toISOString().split("T")[0];
    const lastYearYtdStart = `${year - 1}-01-01`;
    const lastYearYtdEnd = `${year - 1}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;

    const ytdUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.completedDate} >= ${yearStart}`,
          sql`${buildingPermits.completedDate} <= ${ytdDate}`
        )
      );

    const lastYearYtdUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.completedDate} >= ${lastYearYtdStart}`,
          sql`${buildingPermits.completedDate} <= ${lastYearYtdEnd}`
        )
      );

    const ytdPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.appliedDate} >= ${yearStart}`,
          sql`${buildingPermits.appliedDate} <= ${ytdDate}`,
          sql`${buildingPermits.housingUnitsAdded} > 0`
        )
      );

    const lastYearYtdPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.appliedDate} >= ${lastYearYtdStart}`,
          sql`${buildingPermits.appliedDate} <= ${lastYearYtdEnd}`,
          sql`${buildingPermits.housingUnitsAdded} > 0`
        )
      );

    ytdStats = {
      units: ytdUnits[0]?.total || 0,
      lastYearUnits: lastYearYtdUnits[0]?.total || 0,
      unitsPercentChange: lastYearYtdUnits[0]?.total
        ? (((ytdUnits[0]?.total || 0) - lastYearYtdUnits[0].total) /
            lastYearYtdUnits[0].total) *
          100
        : 0,
      permits: ytdPermits[0]?.count || 0,
      lastYearPermits: lastYearYtdPermits[0]?.count || 0,
      permitsPercentChange: lastYearYtdPermits[0]?.count
        ? (((ytdPermits[0]?.count || 0) - lastYearYtdPermits[0].count) /
            lastYearYtdPermits[0].count) *
          100
        : 0,
    };
  }

  return {
    housingUnitsCompleted: housingUnitsCompleted[0]?.total || 0,
    permitsApplied: permitsApplied[0]?.count || 0,
    ytdStats,
  };
}

async function getTopPermits(year: number) {
  return await db
    .select({
      permitNum: buildingPermits.permitNum,
      completedDate: buildingPermits.completedDate,
      housingUnitsAdded: buildingPermits.housingUnitsAdded,
      originalAddress1: buildingPermits.originalAddress1,
      description: buildingPermits.description,
      link: buildingPermits.link,
    })
    .from(buildingPermits)
    .where(
      and(
        sql`EXTRACT(YEAR FROM ${buildingPermits.completedDate}) = ${year}`,
        isNotNull(buildingPermits.housingUnitsAdded),
        isNotNull(buildingPermits.completedDate),
        sql`${buildingPermits.housingUnitsAdded} > 0`
      )
    )
    .orderBy(desc(buildingPermits.housingUnitsAdded))
    .limit(10);
}

export default async function Home() {
  const currentYear = new Date().getFullYear();
  const stats = await getYearStats(currentYear);
  const topPermits = await getTopPermits(currentYear);

  const isCurrentYear = true;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">
          Seattle Building Permit Tracker
        </h1>

        <DashboardNav />

        {/* Year Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {isCurrentYear && stats.ytdStats ? (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-2">
                  Housing Units YTD (
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  )
                </div>
                <Link
                  href={`/construction?start=${currentYear}-01-01&end=${
                    new Date().toISOString().split("T")[0]
                  }`}
                  className="block text-4xl font-bold text-blue-600 mb-2 hover:text-blue-700"
                >
                  {stats.ytdStats.units.toLocaleString()}
                </Link>
                <div
                  className={`text-sm mb-3 ${
                    stats.ytdStats.unitsPercentChange >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {stats.ytdStats.unitsPercentChange >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(stats.ytdStats.unitsPercentChange).toFixed(1)}% vs
                  last year
                </div>
                <Link
                  href={`/construction?start=${currentYear - 1}-01-01&end=${
                    new Date(new Date().setFullYear(currentYear - 1))
                      .toISOString()
                      .split("T")[0]
                  }`}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {stats.ytdStats.lastYearUnits.toLocaleString()} units same
                  period last year →
                </Link>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-2">
                  Permits Applied YTD (
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  )
                </div>
                <Link
                  href={`/applications?start=${currentYear}-01-01&end=${
                    new Date().toISOString().split("T")[0]
                  }`}
                  className="block text-4xl font-bold text-blue-600 mb-2 hover:text-blue-700"
                >
                  {stats.ytdStats.permits.toLocaleString()}
                </Link>
                <div
                  className={`text-sm mb-3 ${
                    stats.ytdStats.permitsPercentChange >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {stats.ytdStats.permitsPercentChange >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(stats.ytdStats.permitsPercentChange).toFixed(1)}% vs
                  last year
                </div>
                <Link
                  href={`/applications?start=${currentYear - 1}-01-01&end=${
                    new Date(new Date().setFullYear(currentYear - 1))
                      .toISOString()
                      .split("T")[0]
                  }`}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {stats.ytdStats.lastYearPermits.toLocaleString()} permits same
                  period last year →
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link
                href={`/construction?start=${currentYear}-01-01&end=${currentYear}-12-31`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="text-sm text-gray-600 mb-2">
                  Housing Units Completed ({currentYear})
                </div>
                <div className="text-4xl font-bold text-blue-600">
                  {stats.housingUnitsCompleted.toLocaleString()}
                </div>
              </Link>
              <Link
                href={`/applications?start=${currentYear}-01-01&end=${currentYear}-12-31`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="text-sm text-gray-600 mb-2">
                  Permits Applied ({currentYear})
                </div>
                <div className="text-4xl font-bold text-blue-600">
                  {stats.permitsApplied.toLocaleString()}
                </div>
              </Link>
            </>
          )}
        </div>

        {/* Top Permits */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 bg-white rounded-lg p-4 shadow">
            Top Permits by Completed Housing Units ({currentYear})
          </h2>

          <div className="flex flex-col gap-4">
            {topPermits.map((permit, idx) => (
              <div
                key={permit.permitNum}
                className="bg-white rounded-lg shadow p-4 flex flex-row items-center gap-6 overflow-hidden"
              >
                {/* Rank badge (subtler) */}
                <div className="flex-none w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-semibold text-sm">
                  #{idx + 1}
                </div>
                {/* Main info stack */}
                <div className="flex-1 flex flex-col md:flex-row md:items-center md:gap-6 min-w-0">
                  {/* Permit meta (fixed width) */}
                  <div className="w-28 flex-shrink-0 flex flex-col">
                    <div className="flex items-center gap-2 text-lg font-semibold tabular-nums">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-gray-500"
                      >
                        <path d="M10.707 1.293a1 1 0 00-1.414 0L2 8.586V17a1 1 0 001 1h5v-5h4v5h5a1 1 0 001-1V8.586l-7.293-7.293z" />
                      </svg>
                      <span className="truncate">
                        {permit.housingUnitsAdded?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Units</div>
                  </div>
                  {/* Permit number and date (fixed width) */}
                  <div className="w-48 flex-shrink-0 flex flex-col">
                    {permit.link ? (
                      <a
                        href={permit.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-600 hover:underline truncate block"
                      >
                        {permit.permitNum}
                      </a>
                    ) : (
                      <div className="font-mono text-gray-900 truncate">
                        {permit.permitNum}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {permit.completedDate
                        ? new Date(permit.completedDate).toLocaleDateString()
                        : "-"}
                    </div>
                  </div>
                  {/* Address and description (flex, truncates) */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 truncate">
                      {permit.originalAddress1 ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            permit.originalAddress1 + ", Seattle, WA"
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-700 hover:underline truncate block"
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DataFooter />
      </div>
    </div>
  );
}
