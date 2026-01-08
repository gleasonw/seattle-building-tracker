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
    const lastYearYtdEnd = `${year - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
      unitsPercentChange:
        lastYearYtdUnits[0]?.total
          ? (((ytdUnits[0]?.total || 0) - lastYearYtdUnits[0].total) /
              lastYearYtdUnits[0].total) *
            100
          : 0,
      permits: ytdPermits[0]?.count || 0,
      lastYearPermits: lastYearYtdPermits[0]?.count || 0,
      permitsPercentChange:
        lastYearYtdPermits[0]?.count
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
                  href={`/trends?start=${currentYear}-01-01&end=${new Date().toISOString().split("T")[0]}&dateType=completed`}
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
                  {Math.abs(stats.ytdStats.unitsPercentChange).toFixed(1)}% vs last year
                </div>
                <Link
                  href={`/trends?start=${currentYear - 1}-01-01&end=${new Date(new Date().setFullYear(currentYear - 1)).toISOString().split("T")[0]}&dateType=completed`}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {stats.ytdStats.lastYearUnits.toLocaleString()} units same period last year →
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
                  href={`/trends?start=${currentYear}-01-01&end=${new Date().toISOString().split("T")[0]}&dateType=applied&metric=applications`}
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
                  {Math.abs(stats.ytdStats.permitsPercentChange).toFixed(1)}% vs last year
                </div>
                <Link
                  href={`/trends?start=${currentYear - 1}-01-01&end=${new Date(new Date().setFullYear(currentYear - 1)).toISOString().split("T")[0]}&dateType=applied&metric=applications`}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {stats.ytdStats.lastYearPermits.toLocaleString()} permits same period last year →
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link
                href={`/trends?start=${currentYear}-01-01&end=${currentYear}-12-31&dateType=completed`}
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
                href={`/trends?start=${currentYear}-01-01&end=${currentYear}-12-31&dateType=applied&metric=applications`}
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
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Top Permits by Housing Units ({currentYear})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-sm">
                    Permit Number
                  </th>
                  <th className="text-left p-3 font-semibold text-sm">
                    Completed Date
                  </th>
                  <th className="text-left p-3 font-semibold text-sm">
                    Address
                  </th>
                  <th className="text-right p-3 font-semibold text-sm">
                    Units
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPermits.map((permit) => (
                  <tr
                    key={permit.permitNum}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="p-3 text-sm">
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
                    <td className="p-3 text-sm">
                      {permit.completedDate
                        ? new Date(permit.completedDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3 text-sm max-w-md">
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
                    <td className="p-3 text-sm text-right tabular-nums font-medium">
                      {permit.housingUnitsAdded?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DataFooter />
      </div>
    </div>
  );
}
