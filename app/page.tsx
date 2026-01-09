import { db } from "@/server/src/db";
import { and, desc, isNotNull, sql } from "drizzle-orm";
import { buildingPermits } from "@/server/src/db/schema";
import Link from "next/link";
import YearNavigation from "./components/YearNavigation";

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
        sql`${buildingPermits.appliedDate} <= ${yearEnd}`
      )
    );

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
          sql`${buildingPermits.appliedDate} <= ${ytdDate}`
        )
      );

    console.log(
      `LAST YEAR YTD START: ${lastYearYtdStart}, END: ${lastYearYtdEnd}`
    );
    const lastYearYtdPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.appliedDate} >= ${lastYearYtdStart}`,
          sql`${buildingPermits.appliedDate} <= ${lastYearYtdEnd}`
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
  } else {
    // Get previous year full year stats for comparison
    const previousYearStart = `${year - 1}-01-01`;
    const previousYearEnd = `${year - 1}-12-31`;

    const previousYearUnits = await db
      .select({
        total: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.completedDate} >= ${previousYearStart}`,
          sql`${buildingPermits.completedDate} <= ${previousYearEnd}`
        )
      );

    const previousYearPermits = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(
        and(
          sql`${buildingPermits.appliedDate} >= ${previousYearStart}`,
          sql`${buildingPermits.appliedDate} <= ${previousYearEnd}`
        )
      );

    console.log({ previousYearPermits });

    const prevYearUnitsTotal = previousYearUnits[0]?.total || 0;
    const prevYearPermitsTotal = previousYearPermits[0]?.count || 0;

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
    };
  }

  return {
    housingUnitsCompleted: housingUnitsCompleted[0]?.total || 0,
    permitsApplied: permitsApplied[0]?.count || 0,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {isCurrentYear && stats.ytdStats ? (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-2">
                Housing Units Completed YTD (
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                )
              </div>
              <Link
                href={`/construction?start=${targetYear}-01-01&end=${
                  new Date().toISOString().split("T")[0]
                }&period=month`}
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
                href={`/construction?start=${targetYear - 1}-01-01&end=${
                  new Date(new Date().setFullYear(targetYear - 1))
                    .toISOString()
                    .split("T")[0]
                }&period=month`}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {stats.ytdStats.lastYearUnits.toLocaleString()} units same
                period last year →
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-2">
                Building permit applications YTD (
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                )
              </div>
              <Link
                href={`/applications?start=${targetYear}-01-01&end=${
                  new Date().toISOString().split("T")[0]
                }&period=month`}
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
                href={`/applications?start=${targetYear - 1}-01-01&end=${
                  new Date(new Date().setFullYear(targetYear - 1))
                    .toISOString()
                    .split("T")[0]
                }&period=month`}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {stats.ytdStats.lastYearPermits.toLocaleString()} permits same
                period last year →
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-2">
                Housing Units Completed ({targetYear})
              </div>
              <Link
                href={`/construction?start=${targetYear}-01-01&end=${targetYear}-12-31&period=month`}
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
                    href={`/construction?start=${targetYear - 1}-01-01&end=${
                      targetYear - 1
                    }-12-31&period=month`}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {stats.previousYearStats.units.toLocaleString()} units in{" "}
                    {targetYear - 1} →
                  </Link>
                </>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-2">
                Building permit applications ({targetYear})
              </div>
              <Link
                href={`/applications?start=${targetYear}-01-01&end=${targetYear}-12-31&period=month`}
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
                    href={`/applications?start=${targetYear - 1}-01-01&end=${
                      targetYear - 1
                    }-12-31`}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {stats.previousYearStats.permits.toLocaleString()} permits
                    in {targetYear - 1} →
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
    </div>
  );
}
