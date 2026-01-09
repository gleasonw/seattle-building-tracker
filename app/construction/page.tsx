import { db } from "@/server/src/db";
import { buildingPermits } from "@/server/src/db/schema";
import { sql, and } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import {
  buildFiltersFromParams,
  createSeattleDataUrl,
} from "@/server/src/query";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import { ConstructionChart } from "@/app/construction/ConstructionChart";
import RecordsTable from "@/app/components/RecordsTable";
import FiltersSidebar from "@/app/components/FiltersSidebar";
import FilterBadges from "@/app/components/FilterBadges";
import MobileFilters from "@/app/components/MobileFilters";
import { Suspense } from "react";

type SortField =
  | "appliedDate"
  | "completedDate"
  | "housingUnitsAdded"
  | "permitNum";
type SortOrder = "asc" | "desc";

interface SearchParams {
  start?: string;
  end?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  address?: string;
  radius?: string;
  lat?: string;
  lng?: string;
}

async function getTrendsData(params: SearchParams) {
  const dateField = buildingPermits.completedDate;

  const conditions = buildFiltersFromParams({
    targetDateField: dateField,
    initialParams: params,
  });

  const monthlyData = await db
    .select({
      year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
      month: sql<number>`CAST(EXTRACT(MONTH FROM ${dateField}) AS INTEGER)`,
      totalUnitsAdded: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...conditions))
    .groupBy(
      sql`EXTRACT(YEAR FROM ${dateField})`,
      sql`EXTRACT(MONTH FROM ${dateField})`
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${dateField})`,
      sql`EXTRACT(MONTH FROM ${dateField})`
    );

  const yearlyData = await db
    .select({
      year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
      totalUnitsAdded: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...conditions))
    .groupBy(sql`EXTRACT(YEAR FROM ${dateField})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${dateField})`);

  return {
    monthlyData,
    yearlyData,
  };
}

async function getRecords(params: BuildingDashSearchParams) {
  const { sortBy = "housingUnitsAdded", sortOrder = "desc" } = params;

  const conditions = buildFiltersFromParams({
    targetDateField: buildingPermits.completedDate,
    initialParams: params,
  });

  const sortColumn = {
    appliedDate: buildingPermits.appliedDate,
    completedDate: buildingPermits.completedDate,
    housingUnitsAdded: buildingPermits.housingUnitsAdded,
    permitNum: buildingPermits.permitNum,
  }[sortBy];

  if (!sortColumn) {
    throw new Error(`Invalid sortBy field: ${sortBy}`);
  }

  const sortFn = sortOrder === "asc" ? asc : desc;

  // Get total count before applying limit
  const countResult = await db
    .select({
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...conditions));

  const totalCount = countResult[0]?.count || 0;

  const results = await db
    .select({
      permitNum: buildingPermits.permitNum,
      appliedDate: buildingPermits.appliedDate,
      completedDate: buildingPermits.completedDate,
      housingUnitsAdded: buildingPermits.housingUnitsAdded,
      originalAddress1: buildingPermits.originalAddress1,
      permitTypeMapped: buildingPermits.permitTypeMapped,
      description: buildingPermits.description,
      link: buildingPermits.link,
      estProjectCost: buildingPermits.estProjectCost,
      latitude: buildingPermits.latitude,
      longitude: buildingPermits.longitude,
    })
    .from(buildingPermits)
    .where(and(...conditions))
    .orderBy(sql`${sortFn(sortColumn)} nulls last`)
    .limit(500);

  return { records: results, totalCount };
}

export default async function ConstructionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const trendsData = await getTrendsData(params);
  const { records, totalCount } = await getRecords(params);
  const initialParams = await searchParams;
  const seattleDataUrl = createSeattleDataUrl({
    initialParams,
    extraFilters: ["`completeddate` IS NOT NULL"],
  });

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      {/* Mobile Filter Button */}
      <MobileFilters>
        <FiltersSidebar
          initialParams={initialParams}
          yearRangeLabel="Construction Completed Date"
        />
      </MobileFilters>

      {/* Desktop Sidebar */}
      <div
        className="hidden lg:block lg:w-80 overflow-y-auto"
        style={{ height: "calc(100vh - 120px)" }}
      >
        <Suspense>
          <FiltersSidebar
            initialParams={initialParams}
            yearRangeLabel="Construction Completed Date"
          />
        </Suspense>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Seattle housing units added
        </h1>
        <Suspense>
          <FilterBadges />
        </Suspense>
        <Suspense>
          <ConstructionChart
            data={trendsData}
            startDate={initialParams.start}
            endDate={initialParams.end}
          />
        </Suspense>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 mb-4">
            {totalCount.toLocaleString()} record{totalCount !== 1 ? "s" : ""}{" "}
            found
            {totalCount > 500 && " (showing first 500)"}
          </div>
          <a
            href={seattleDataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View in Seattle Open Data Portal →
          </a>
        </div>
        <RecordsTable records={records} initialParams={initialParams} />
      </div>
    </div>
  );
}
