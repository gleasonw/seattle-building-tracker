import { db } from "@/server/src/db";
import { buildingPermits } from "@/server/src/db/schema";
import { sql, and } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import {
  buildFiltersFromParams,
  createSeattleDataUrl,
} from "@/server/src/query";
import {
  BuildingDashSearchParams,
  PermitRowFilters,
} from "@/app/PermitRowFilters";
import ApplicationsChart from "@/app/applications/ApplicationsChart";
import RecordsTable from "@/app/components/RecordsTable";

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
  const dateField = buildingPermits.appliedDate;

  const conditions = buildFiltersFromParams({
    targetDateField: dateField,
    initialParams: params,
  });

  const monthlyData = await db
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
    );

  const yearlyData = await db
    .select({
      year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
      applicationCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
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

export type ApplicationRecord = Awaited<
  ReturnType<typeof getRecords>
>["records"][number];

async function getRecords(params: BuildingDashSearchParams) {
  const conditions = buildFiltersFromParams({
    targetDateField: buildingPermits.appliedDate,
    initialParams: params,
  });

  const { sortBy = "appliedDate", sortOrder = "desc" } = params;

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

  console.log(`GENERIC RECORD GET START`);

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
      statusCurrent: buildingPermits.statusCurrent,
    })
    .from(buildingPermits)
    .where(and(...conditions))
    .orderBy(sql`${sortFn(sortColumn)} nulls last`)
    .limit(500);

  return { records: results, totalCount };
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const initialParams = await searchParams;
  const trendsData = await getTrendsData(initialParams);
  const { records, totalCount } = await getRecords(initialParams);
  const seattleDataUrl = createSeattleDataUrl({
    initialParams,
    extraFilters: ["`applieddate` IS NOT NULL"],
  });

  return (
    <div>
      <div className="flex gap-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Seattle building applications submitted
        </h1>
        <PermitRowFilters
          initialParams={initialParams}
          yearRangeLabel={
            <div className="block text-sm font-medium text-gray-700 mb-1">
              Application Submitted Date
            </div>
          }
        />
      </div>

      <ApplicationsChart
        data={trendsData}
        startDate={initialParams.start}
        endDate={initialParams.end}
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
        initialParams={initialParams}
        extraFields={[{ key: "statusCurrent", label: "Current Status" }]}
      />
    </div>
  );
}
