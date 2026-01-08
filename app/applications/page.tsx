import { db } from "@/server/src/db";
import { buildingPermits } from "@/server/src/db/schema";
import { sql, and, isNotNull } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import DashboardNav from "../components/DashboardNav";
import DataFooter from "../components/DataFooter";
import ApplicationsClient from "./ApplicationsClient";

type SortField =
  | "appliedDate"
  | "completedDate"
  | "housingUnitsAdded"
  | "permitNum";
type SortOrder = "asc" | "desc";

interface SearchParams {
  start?: string;
  end?: string;
  tableStart?: string;
  tableEnd?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  address?: string;
  radius?: string;
  lat?: string;
  lng?: string;
}

async function getTrendsData(params: SearchParams) {
  const { start, end, lat, lng, radius } = params;

  const dateField = buildingPermits.appliedDate;

  const conditions = [isNotNull(dateField)];

  if (start) {
    conditions.push(sql`${dateField} >= ${start}`);
  }
  if (end) {
    conditions.push(sql`${dateField} <= ${end}`);
  }

  // Add geographic filter if coordinates and radius are provided
  if (lat && lng && radius) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusMiles = parseFloat(radius);

    conditions.push(
      sql`(
        3959 * acos(
          cos(radians(${latNum})) *
          cos(radians(CAST(${buildingPermits.latitude} AS DOUBLE PRECISION))) *
          cos(radians(CAST(${buildingPermits.longitude} AS DOUBLE PRECISION)) - radians(${lngNum})) +
          sin(radians(${latNum})) *
          sin(radians(CAST(${buildingPermits.latitude} AS DOUBLE PRECISION)))
        )
      ) <= ${radiusMiles}`
    );
    conditions.push(isNotNull(buildingPermits.latitude));
    conditions.push(isNotNull(buildingPermits.longitude));
  }

  // Get monthly data for applications
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

  // Get quarterly data for applications
  const quarterlyData = await db
    .select({
      year: sql<number>`CAST(EXTRACT(YEAR FROM ${dateField}) AS INTEGER)`,
      quarter: sql<number>`CAST(EXTRACT(QUARTER FROM ${dateField}) AS INTEGER)`,
      applicationCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(buildingPermits)
    .where(and(...conditions))
    .groupBy(
      sql`EXTRACT(YEAR FROM ${dateField})`,
      sql`EXTRACT(QUARTER FROM ${dateField})`
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${dateField})`,
      sql`EXTRACT(QUARTER FROM ${dateField})`
    );

  // Get yearly data for applications
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
    quarterlyData,
    yearlyData,
  };
}

async function getRecords(params: SearchParams) {
  const {
    tableStart,
    tableEnd,
    sortBy = "appliedDate",
    sortOrder = "desc",
    lat,
    lng,
    radius,
  } = params;

  const dateField = buildingPermits.appliedDate;

  const conditions = [isNotNull(dateField)];

  if (tableStart) {
    conditions.push(sql`${dateField} >= ${tableStart}`);
  }
  if (tableEnd) {
    conditions.push(sql`${dateField} <= ${tableEnd}`);
  }

  // Add geographic filter if coordinates and radius are provided
  if (lat && lng && radius) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusMiles = parseFloat(radius);

    conditions.push(
      sql`(
        3959 * acos(
          cos(radians(${latNum})) *
          cos(radians(CAST(${buildingPermits.latitude} AS DOUBLE PRECISION))) *
          cos(radians(CAST(${buildingPermits.longitude} AS DOUBLE PRECISION)) - radians(${lngNum})) +
          sin(radians(${latNum})) *
          sin(radians(CAST(${buildingPermits.latitude} AS DOUBLE PRECISION)))
        )
      ) <= ${radiusMiles}`
    );
    conditions.push(isNotNull(buildingPermits.latitude));
    conditions.push(isNotNull(buildingPermits.longitude));
  }

  const sortColumn = {
    appliedDate: buildingPermits.appliedDate,
    completedDate: buildingPermits.completedDate,
    housingUnitsAdded: buildingPermits.housingUnitsAdded,
    permitNum: buildingPermits.permitNum,
  }[sortBy];

  const sortFn = sortOrder === "asc" ? asc : desc;

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
    .orderBy(sortFn(sortColumn))
    .limit(500);

  return results;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const trendsData = await getTrendsData(params);
  const records = await getRecords(params);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">
          Seattle Building Permit Tracker
        </h1>

        <DashboardNav />

        <ApplicationsClient
          trendsData={trendsData}
          records={records}
          initialParams={params}
        />

        <DataFooter />
      </div>
    </div>
  );
}
