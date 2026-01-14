import { db } from "@/server/src/db";
import { buildingPermits } from "@/server/src/db/schema";
import { sql, and, isNotNull } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import {
  buildFiltersFromParams,
  buildMapFiltersFromParams,
  createSeattleDataUrl,
  dateFieldFromParams,
} from "@/server/src/query";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import ApplicationViews from "@/app/applications/ApplicationViews";
import RecordsTable from "@/app/components/RecordsTable";
import FiltersSidebar from "@/app/components/FiltersSidebar";
import FilterBadges from "@/app/components/FilterBadges";
import MobileFilters from "@/app/components/MobileFilters";
import PermitTypeDescFilter from "@/app/components/PermitTypeDescFilter";
import StatusCurrentFilter from "@/app/components/StatusCurrentFilter";
import HousingUnitsFilter from "@/app/components/HousingUnitsFilter";
import DateFieldToggle from "@/app/components/DateFieldToggle";
import { Suspense } from "react";
import { date } from "drizzle-orm/mysql-core";

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
  permitTypeDesc?: string;
  statusCurrent?: string;
  housingUnitsAddedMin?: string;
  dateField?: "applied" | "completed";
}

async function getApplicationTrendsData(params: SearchParams) {
  const dateField = dateFieldFromParams(params);

  const conditions = buildFiltersFromParams(params);

  const [monthlyData, yearlyData] = await Promise.all([
    db
      .select({
        year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
        month: sql<number>`CAST(EXTRACT(MONTH FROM ${dateField}) AS INTEGER)`,
        applicationCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        pipelineCount: sql<number>`CAST(SUM(CASE
          WHEN LOWER(${buildingPermits.statusCurrent}) NOT IN ('completed', 'closed', 'approved to occupy', 'inspections completed', 'canceled', 'denied', 'expired', 'withdrawn')
          THEN 1 ELSE 0 END) AS INTEGER)`,
        doneCount: sql<number>`CAST(SUM(CASE
          WHEN LOWER(${buildingPermits.statusCurrent}) IN ('completed', 'closed', 'approved to occupy', 'inspections completed')
          THEN 1 ELSE 0 END) AS INTEGER)`,
        canceledCount: sql<number>`CAST(SUM(CASE
          WHEN LOWER(${buildingPermits.statusCurrent}) IN ('canceled', 'denied', 'expired', 'withdrawn')
          THEN 1 ELSE 0 END) AS INTEGER)`,
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
      ),
    db
      .select({
        year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
        applicationCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        pipelineCount: sql<number>`CAST(SUM(CASE
          WHEN LOWER(${buildingPermits.statusCurrent}) NOT IN ('completed', 'closed', 'approved to occupy', 'inspections completed', 'canceled', 'denied', 'expired', 'withdrawn')
          THEN 1 ELSE 0 END) AS INTEGER)`,
        doneCount: sql<number>`CAST(SUM(CASE
          WHEN LOWER(${buildingPermits.statusCurrent}) IN ('completed', 'closed', 'approved to occupy', 'inspections completed')
          THEN 1 ELSE 0 END) AS INTEGER)`,
        canceledCount: sql<number>`CAST(SUM(CASE
          WHEN LOWER(${buildingPermits.statusCurrent}) IN ('canceled', 'denied', 'expired', 'withdrawn')
          THEN 1 ELSE 0 END) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(YEAR FROM ${dateField})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${dateField})`),
  ]);

  return {
    monthlyData,
    yearlyData,
  };
}

async function getConstructionTrendsData(params: SearchParams) {
  const dateField = dateFieldFromParams(params);
  const conditions = buildFiltersFromParams(params);

  const [monthlyData, yearlyData] = await Promise.all([
    db
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
      ),
    db
      .select({
        year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
        totalUnitsAdded: sql<number>`CAST(SUM(COALESCE(${buildingPermits.housingUnitsAdded}, 0)) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(YEAR FROM ${dateField})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${dateField})`),
  ]);

  console.log({ monthlyData, yearlyData });

  return {
    monthlyData,
    yearlyData,
  };
}

export type ApplicationRecord = Awaited<
  ReturnType<typeof getRecords>
>["records"][number];

async function getRecords(params: BuildingDashSearchParams) {
  // Get base filters (everything except geographic filters)
  const baseConditions = buildFiltersFromParams(params);
  // Get map-specific geographic filters (bounding box or radius)
  const mapConditions = buildMapFiltersFromParams(params);
  // Combine for map queries
  const conditions = [...baseConditions, ...mapConditions];

  const { sortBy = "appliedDate", sortOrder = "desc", zoom } = params;

  // Check if we should return neighborhood clusters (zoom < 17)
  const shouldCluster = zoom && parseInt(zoom) < 15;

  if (shouldCluster) {
    // Return neighborhood-aggregated data with map filters
    const [countResult, clusters] = await Promise.all([
      db
        .select({
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        })
        .from(buildingPermits)
        .where(and(...conditions)),
      db
        .select({
          neighborhood: buildingPermits.neighborhood,
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          centerLat: sql<number>`AVG(CAST(${buildingPermits.latitude} AS DOUBLE PRECISION))`,
          centerLng: sql<number>`AVG(CAST(${buildingPermits.longitude} AS DOUBLE PRECISION))`,
          pipelineCount: sql<number>`CAST(SUM(CASE
            WHEN LOWER(${buildingPermits.statusCurrent}) NOT IN ('completed', 'closed', 'approved to occupy', 'inspections completed', 'canceled', 'denied', 'expired', 'withdrawn')
            THEN 1 ELSE 0 END) AS INTEGER)`,
          doneCount: sql<number>`CAST(SUM(CASE
            WHEN LOWER(${buildingPermits.statusCurrent}) IN ('completed', 'closed', 'approved to occupy', 'inspections completed')
            THEN 1 ELSE 0 END) AS INTEGER)`,
          canceledCount: sql<number>`CAST(SUM(CASE
            WHEN LOWER(${buildingPermits.statusCurrent}) IN ('canceled', 'denied', 'expired', 'withdrawn')
            THEN 1 ELSE 0 END) AS INTEGER)`,
        })
        .from(buildingPermits)
        .where(
          and(
            ...conditions,
            isNotNull(buildingPermits.neighborhood),
            isNotNull(buildingPermits.latitude),
            isNotNull(buildingPermits.longitude)
          )
        )
        .groupBy(buildingPermits.neighborhood),
    ]);

    const totalCount = countResult[0]?.count || 0;

    return { clusters, totalCount, isCluster: true as const };
  }

  // Return individual records (zoom >= 17 or no zoom specified)
  // Dynamically access the sort column from buildingPermits schema
  const sortColumn =
    sortBy in buildingPermits
      ? buildingPermits[sortBy as keyof typeof buildingPermits]
      : null;

  if (!sortColumn || !("columnType" in sortColumn)) {
    throw new Error(`Invalid sortBy field: ${sortBy}`);
  }

  const sortFn = sortOrder === "asc" ? asc : desc;

  const [countResult, results] = await Promise.all([
    db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(buildingPermits)
      .where(and(...conditions)),
    db
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
        statusCurrent: buildingPermits.statusCurrent,
        permitTypeDesc: buildingPermits.permitTypeDesc,
      })
      .from(buildingPermits)
      .where(and(...conditions))
      .orderBy(sql`${sortFn(sortColumn)} nulls last`)
      .limit(500),
  ]);

  const totalCount = countResult[0]?.count || 0;

  return { records: results, totalCount, isCluster: false as const };
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const dateField = params.dateField || "applied";

  const [applicationTrends, constructionTrends, recordsResult] =
    await Promise.all([
      getApplicationTrendsData(params),
      getConstructionTrendsData(params),
      getRecords(params),
    ]);

  const { isCluster } = recordsResult;
  const records = isCluster ? undefined : recordsResult.records;
  const clusters = isCluster ? recordsResult.clusters : undefined;
  const totalCount = recordsResult.totalCount;

  const targetDateField =
    dateField === "completed" ? "completeddate" : "applieddate";
  const seattleDataUrl = createSeattleDataUrl({
    initialParams: params,
    targetDateField,
  });

  const sortOptions = [
    { key: "appliedDate", label: "Applied Date" },
    { key: "completedDate", label: "Completed Date" },
    { key: "housingUnitsAdded", label: "Units Added" },
    { key: "permitNum", label: "Permit Number" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-6">
      {/* Mobile Filter Button */}
      <MobileFilters
        sortOptions={sortOptions}
        currentSort={params.sortBy}
        currentOrder={params.sortOrder}
      >
        <FiltersSidebar
          initialParams={params}
          yearRangeLabel={
            dateField === "completed"
              ? "Construction Completed Date"
              : "Application Submitted Date"
          }
          extraFilters={
            <>
              <PermitTypeDescFilter currentValue={params.permitTypeDesc} />
              <StatusCurrentFilter currentValue={params.statusCurrent} />
              <HousingUnitsFilter currentValue={params.housingUnitsAddedMin} />
            </>
          }
        />
      </MobileFilters>

      {/* Desktop Sidebar */}
      <div
        className="hidden lg:block lg:w-80 overflow-y-auto sticky top-0"
        style={{ height: "calc(100vh - 120px)" }}
      >
        <FiltersSidebar
          initialParams={params}
          yearRangeLabel={
            dateField === "completed"
              ? "Construction Completed Date"
              : "Application Submitted Date"
          }
          extraFilters={
            <>
              <PermitTypeDescFilter currentValue={params.permitTypeDesc} />
              <StatusCurrentFilter currentValue={params.statusCurrent} />
              <HousingUnitsFilter currentValue={params.housingUnitsAddedMin} />
            </>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 sm:px-4 lg:px-6">
        <Suspense>
          <FilterBadges />
        </Suspense>

        <ApplicationViews
          applicationTrends={applicationTrends}
          constructionTrends={constructionTrends}
          records={records}
          clusters={clusters}
          isCluster={isCluster}
          startDate={params.start}
          endDate={params.end}
          extra={
            <div className="flex items-center justify-between" key="extra">
              <div className="text-sm text-gray-600">
                {totalCount.toLocaleString()} record
                {totalCount !== 1 ? "s" : ""} found
                {isCluster
                  ? " (zoom in to see individual permits)"
                  : records && records.length < totalCount
                  ? ` (showing ${records.length} in view)`
                  : ""}
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
          }
        />
        {!isCluster && records && (
          <RecordsTable
            records={records}
            initialParams={params}
            dateColumns={[
              { key: "appliedDate", label: "Applied Date" },
              { key: "completedDate", label: "Completed Date" },
            ]}
            extraFields={[
              { key: "statusCurrent", label: "Current Status", sortable: true },
              { key: "permitTypeDesc", label: "Permit Type Description" },
            ]}
          />
        )}
      </div>
    </div>
  );
}
