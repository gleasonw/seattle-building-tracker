import { db } from "@/server/src/db";
import { and, desc, isNotNull, sql } from "drizzle-orm";
import { buildingPermits } from "@/server/src/db/schema";
import Link from "next/link";
import YearNavigation from "./components/YearNavigation";
import { buildFiltersFromParams } from "@/server/src/query";
import { buildingPermitLink } from "@/lib/utils";

async function getYearStats(year: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const constructionConditions = buildFiltersFromParams({
    start: yearStart,
    end: yearEnd,
    dateField: "completed",
  });

  // Housing units completed this year
  const housingUnitsCompleted = await db
    .select({
      total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...constructionConditions));

  const permitConditions = buildFiltersFromParams({
    start: yearStart,
    end: yearEnd,
    dateField: "applied",
  });

  // Permits applied this year
  const permitsApplied = await db
    .select({
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...permitConditions));

  // Housing units planned (based on applied date)
  const housingUnitsPlanned = await db
    .select({
      total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...permitConditions));

  // Get YTD stats if current year, or previous year comparison if not
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  let ytdStats = null;
  let previousYearStats = null;

  if (year === currentYear) {
    const ytdDate = now.toISOString().split("T")[0];
    const lastYearYtdStart = `${year - 1}-01-01`;
    const lastYearYtdEnd = `${year - 1}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    const ytdUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          ...buildFiltersFromParams({
            start: yearStart,
            end: ytdDate,
            dateField: "completed",
          })
        )
      );

    const lastYearYtdUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          ...buildFiltersFromParams({
            start: lastYearYtdStart,
            end: lastYearYtdEnd,
            dateField: "completed",
          })
        )
      );

    const ytdPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          ...buildFiltersFromParams({
            start: yearStart,
            end: ytdDate,
            dateField: "applied",
          })
        )
      );

    const lastYearYtdPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          ...buildFiltersFromParams({
            start: lastYearYtdStart,
            end: lastYearYtdEnd,
            dateField: "applied",
          })
        )
      );

    const ytdPlannedUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          ...buildFiltersFromParams({
            start: yearStart,
            end: ytdDate,
            dateField: "applied",
          })
        )
      );

    const lastYearYtdPlannedUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          ...buildFiltersFromParams({
            start: lastYearYtdStart,
            end: lastYearYtdEnd,
            dateField: "applied",
          })
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
      plannedUnits: ytdPlannedUnits[0]?.total || 0,
      lastYearPlannedUnits: lastYearYtdPlannedUnits[0]?.total || 0,
      plannedUnitsPercentChange: lastYearYtdPlannedUnits[0]?.total
        ? (((ytdPlannedUnits[0]?.total || 0) -
            lastYearYtdPlannedUnits[0].total) /
            lastYearYtdPlannedUnits[0].total) *
          100
        : 0,
    };
  } else {
    // Get previous year full year stats for comparison
    const previousYearStart = `${year - 1}-01-01`;
    const previousYearEnd = `${year - 1}-12-31`;

    const previousYearConstructionConditions = buildFiltersFromParams({
      start: previousYearStart,
      end: previousYearEnd,
      dateField: "completed",
    });

    const previousYearPermitConditions = buildFiltersFromParams({
      start: previousYearStart,
      end: previousYearEnd,
      dateField: "applied",
    });

    const previousYearUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(and(...previousYearConstructionConditions));

    const previousYearPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(and(...previousYearPermitConditions));

    const previousYearPlannedUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(and(...previousYearPermitConditions));

    console.log({ previousYearPermits });

    const prevYearUnitsTotal = previousYearUnits[0]?.total || 0;
    const prevYearPermitsTotal = previousYearPermits[0]?.count || 0;
    const prevYearPlannedUnitsTotal = previousYearPlannedUnits[0]?.total || 0;

    previousYearStats = {
      units: prevYearUnitsTotal,
      unitsPercentChange: prevYearUnitsTotal
        ? (((housingUnitsCompleted[0]?.total || 0) - prevYearUnitsTotal) /
            prevYearUnitsTotal) *
          100
        : 0,
      permits: prevYearPermitsTotal,
      permitsPercentChange: prevYearPermitsTotal
        ? (((permitsApplied[0]?.count || 0) - prevYearPermitsTotal) /
            prevYearPermitsTotal) *
          100
        : 0,
      plannedUnits: prevYearPlannedUnitsTotal,
      plannedUnitsPercentChange: prevYearPlannedUnitsTotal
        ? (((housingUnitsPlanned[0]?.total || 0) - prevYearPlannedUnitsTotal) /
            prevYearPlannedUnitsTotal) *
          100
        : 0,
    };
  }

  return {
    housingUnitsCompleted: housingUnitsCompleted[0]?.total || 0,
    permitsApplied: permitsApplied[0]?.count || 0,
    housingUnitsPlanned: housingUnitsPlanned[0]?.total || 0,
    ytdStats,
    previousYearStats,
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getUTCFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : currentYear;

  return <YearView year={selectedYear} />;
}

async function YearView({ year }: { year: number }) {
  const targetYear = year;
  const stats = await getYearStats(targetYear);
  const topPermits = await getTopPermits(targetYear);

  const isCurrentYear = targetYear === new Date().getUTCFullYear();

  return (
    <div className="max-w-7xl mx-auto">
      <YearNavigation currentYear={targetYear} minYear={2010} />

      {/* Year Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {isCurrentYear && stats.ytdStats ? (
          <>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-green-600 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  Housing Units Completed YTD (
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  )
                </div>
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear}-01-01`,
                  end: new Date().toISOString().split("T")[0],
                  period: "month",
                  dateField: "completed",
                })}
                className="block text-4xl font-bold mb-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
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
                href={buildingPermitLink("/applications", {
                  start: `${targetYear - 1}-01-01`,
                  end: new Date(new Date().setFullYear(targetYear - 1))
                    .toISOString()
                    .split("T")[0],
                  period: "month",
                })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {stats.ytdStats.lastYearUnits.toLocaleString()} units same
                period last year →
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-blue-600 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  Building permit applications YTD (
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  )
                </div>
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear}-01-01`,
                  end: new Date().toISOString().split("T")[0],
                  period: "month",
                })}
                className="block text-4xl font-bold mb-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
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
                href={buildingPermitLink("/applications", {
                  start: `${targetYear - 1}-01-01`,
                  end: new Date(new Date().setFullYear(targetYear - 1))
                    .toISOString()
                    .split("T")[0],
                  period: "month",
                })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {stats.ytdStats.lastYearPermits.toLocaleString()} permits same
                period last year →
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-amber-600 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5V7A2.5 2.5 0 0011 4.5H8.128a2.252 2.252 0 011.884-1.488A2.25 2.25 0 0112.25 1h1.5a2.25 2.25 0 012.238 2.012zM11.5 3.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.25h-3v-.25z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M2 7a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7zm2 3.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm0 3.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  Housing Units Applied For YTD (
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  )
                </div>
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear}-01-01`,
                  end: new Date().toISOString().split("T")[0],
                  period: "month",
                  dateField: "applied",
                })}
                className="block text-4xl font-bold mb-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {stats.ytdStats.plannedUnits.toLocaleString()}
              </Link>
              <div
                className={`text-sm mb-3 ${
                  stats.ytdStats.plannedUnitsPercentChange >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {stats.ytdStats.plannedUnitsPercentChange >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(stats.ytdStats.plannedUnitsPercentChange).toFixed(1)}%
                vs last year
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear - 1}-01-01`,
                  end: new Date(new Date().setFullYear(targetYear - 1))
                    .toISOString()
                    .split("T")[0],
                  period: "month",
                  dateField: "applied",
                })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {stats.ytdStats.lastYearPlannedUnits.toLocaleString()} units
                same period last year →
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-green-600 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  Housing Units Completed ({targetYear})
                </div>
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear}-01-01`,
                  end: `${targetYear}-12-31`,
                  period: "month",
                  dateField: "completed",
                })}
                className="block text-4xl font-bold mb-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {stats.housingUnitsCompleted.toLocaleString()}
              </Link>
              {stats.previousYearStats && (
                <>
                  <div
                    className={`text-sm mb-3 ${
                      stats.previousYearStats.unitsPercentChange >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {stats.previousYearStats.unitsPercentChange >= 0
                      ? "↑"
                      : "↓"}{" "}
                    {Math.abs(
                      stats.previousYearStats.unitsPercentChange
                    ).toFixed(1)}
                    % vs {targetYear - 1}
                  </div>
                  <Link
                    href={buildingPermitLink("/applications", {
                      start: `${targetYear - 1}-01-01`,
                      end: `${targetYear - 1}-12-31`,
                      period: "month",
                    })}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {stats.previousYearStats.units.toLocaleString()} units in{" "}
                    {targetYear - 1} →
                  </Link>
                </>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-blue-600 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  Building permit applications ({targetYear})
                </div>
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear}-01-01`,
                  end: `${targetYear}-12-31`,
                  period: "month",
                })}
                className="block text-4xl font-bold mb-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {stats.permitsApplied.toLocaleString()}
              </Link>
              {stats.previousYearStats && (
                <>
                  <div
                    className={`text-sm mb-3 ${
                      stats.previousYearStats.permitsPercentChange >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {stats.previousYearStats.permitsPercentChange >= 0
                      ? "↑"
                      : "↓"}{" "}
                    {Math.abs(
                      stats.previousYearStats.permitsPercentChange
                    ).toFixed(1)}
                    % vs {targetYear - 1}
                  </div>
                  <Link
                    href={buildingPermitLink("/applications", {
                      start: `${targetYear - 1}-01-01`,
                      end: `${targetYear - 1}-12-31`,
                    })}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {stats.previousYearStats.permits.toLocaleString()} permits
                    in {targetYear - 1} →
                  </Link>
                </>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-amber-600 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5V7A2.5 2.5 0 0011 4.5H8.128a2.252 2.252 0 011.884-1.488A2.25 2.25 0 0112.25 1h1.5a2.25 2.25 0 012.238 2.012zM11.5 3.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.25h-3v-.25z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M2 7a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7zm2 3.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm0 3.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  Housing Units Applied For ({targetYear})
                </div>
              </div>
              <Link
                href={buildingPermitLink("/applications", {
                  start: `${targetYear}-01-01`,
                  end: `${targetYear}-12-31`,
                  period: "month",
                  dateField: "applied",
                })}
                className="block text-4xl font-bold mb-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {stats.housingUnitsPlanned.toLocaleString()}
              </Link>
              {stats.previousYearStats && (
                <>
                  <div
                    className={`text-sm mb-3 ${
                      stats.previousYearStats.plannedUnitsPercentChange >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {stats.previousYearStats.plannedUnitsPercentChange >= 0
                      ? "↑"
                      : "↓"}{" "}
                    {Math.abs(
                      stats.previousYearStats.plannedUnitsPercentChange
                    ).toFixed(1)}
                    % vs {targetYear - 1}
                  </div>
                  <Link
                    href={buildingPermitLink("/applications", {
                      start: `${targetYear - 1}-01-01`,
                      end: `${targetYear - 1}-12-31`,
                      period: "month",
                      dateField: "applied",
                    })}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {stats.previousYearStats.plannedUnits.toLocaleString()}{" "}
                    units in {targetYear - 1} →
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Top Permits */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4">
          Top Completed Permits by Housing Units Added
        </h2>

        <div className="flex flex-col gap-4">
          {topPermits.map((permit, idx) => (
            <div
              key={permit.permitNum}
              className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 overflow-hidden"
            >
              {/* Rank badge (subtler) */}
              <div className="flex-none w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-semibold text-sm">
                #{idx + 1}
              </div>
              {/* Main info stack */}
              <div className="flex-1 flex flex-col md:flex-row md:items-center md:gap-6 min-w-0 w-full">
                {/* Permit meta (fixed width) */}
                <div className="w-full md:w-28 shrink-0 flex flex-col">
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
                <div className="w-full md:w-48 shrink-0 flex flex-col">
                  {permit.link ? (
                    <a
                      href={permit.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm sm:text-base text-blue-600 hover:underline truncate block"
                    >
                      {permit.permitNum}
                    </a>
                  ) : (
                    <div className="font-mono text-sm sm:text-base text-gray-900 truncate">
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
                <div className="flex-1 min-w-0 w-full">
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
    </div>
  );
}
