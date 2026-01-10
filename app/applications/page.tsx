import { db } from "@/server/src/db";
import { buildingPermits } from "@/server/src/db/schema";
import { sql, and } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import {
  buildFiltersFromParams,
  createSeattleDataUrl,
} from "@/server/src/query";
import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import ApplicationsChart from "@/app/applications/ApplicationsChart";
import RecordsTable from "@/app/components/RecordsTable";
import FiltersSidebar from "@/app/components/FiltersSidebar";
import FilterBadges from "@/app/components/FilterBadges";
import MobileFilters from "@/app/components/MobileFilters";
import PermitTypeDescFilter from "@/app/components/PermitTypeDescFilter";
import StatusCurrentFilter from "@/app/components/StatusCurrentFilter";
import HousingUnitsFilter from "@/app/components/HousingUnitsFilter";
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
  permitTypeDesc?: string;
  statusCurrent?: string;
  housingUnitsAddedMin?: string;
}

async function getTrendsData(params: SearchParams) {
  const dateField = buildingPermits.appliedDate;

  const conditions = buildFiltersFromParams({
    targetDateField: dateField,
    initialParams: params,
  });

  const [monthlyData, yearlyData] = await Promise.all([
    db
      .select({
        year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
        month: sql<number>`CAST(EXTRACT(MONTH FROM ${dateField}) AS INTEGER)`,
        applicationCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
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

export type ApplicationRecord = Awaited<
  ReturnType<typeof getRecords>
>["records"][number];

async function getRecords(params: BuildingDashSearchParams) {
  const conditions = buildFiltersFromParams({
    targetDateField: buildingPermits.appliedDate,
    initialParams: params,
  });

  const { sortBy = "appliedDate", sortOrder = "desc" } = params;

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

  return { records: results, totalCount };
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [trendsData, { records, totalCount }] = await Promise.all([
    getTrendsData(params),
    getRecords(params),
  ]);
  const seattleDataUrl = createSeattleDataUrl({
    initialParams: params,
    targetDateField: "applieddate",
  });

  const sortOptions = [
    { key: "appliedDate", label: "Applied Date" },
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
          yearRangeLabel="Application Submitted Date"
          records={records}
          extraTopFilters={
            <>
              <PermitTypeDescFilter currentValue={params.permitTypeDesc} />
              <StatusCurrentFilter currentValue={params.statusCurrent} />
              <HousingUnitsFilter
                currentValue={params.housingUnitsAddedMin}
              />
            </>
          }
        />
      </MobileFilters>

      {/* Desktop Sidebar */}
      <div
        className="hidden lg:block lg:w-80 overflow-y-auto"
        style={{ height: "calc(100vh - 120px)" }}
      >
        <FiltersSidebar
          initialParams={params}
          yearRangeLabel="Application Submitted Date"
          records={records}
          extraTopFilters={
            <>
              <PermitTypeDescFilter currentValue={params.permitTypeDesc} />
              <StatusCurrentFilter currentValue={params.statusCurrent} />
              <HousingUnitsFilter
                currentValue={params.housingUnitsAddedMin}
              />
            </>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 sm:px-4 lg:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Building applications submitted
        </h1>
        <Suspense>
          <FilterBadges />
        </Suspense>

        <ApplicationsChart
          data={trendsData}
          startDate={params.start}
          endDate={params.end}
        />
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

        <RecordsTable
          records={records}
          initialParams={params}
          dateColumns={[{ key: "appliedDate", label: "Applied Date" }]}
          extraFields={[
            { key: "statusCurrent", label: "Current Status", sortable: true },
            { key: "permitTypeDesc", label: "Permit Type Description" },
          ]}
        />
      </div>
    </div>
  );
}
