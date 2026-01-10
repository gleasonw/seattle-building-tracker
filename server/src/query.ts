import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import { buildingPermits } from "@/server/src/db/schema";
import { eq, gt, isNotNull, sql, SQL } from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";

export const DEFAULT_START_DATE = "2010-01-01";

export function createSeattleDataUrl({
  initialParams,
  targetDateField,
}: {
  initialParams: BuildingDashSearchParams;
  targetDateField: "applieddate" | "completeddate";
}) {
  const baseUrl =
    "https://data.seattle.gov/Built-Environment/Building-Permits/76t5-zqzr/explore/query";

  const conditions = [
    "(`permittypemapped` IN ('Building', 'Demolition', 'Land Use'))",
    targetDateField === "completeddate" ? "`housingunitsadded` > 0" : undefined,
  ];

  if (initialParams.start) {
    conditions.push(
      `\`${targetDateField}\` >= '${initialParams.start}T00:00:00'`
    );
  }
  if (initialParams.end) {
    conditions.push(
      `\`${targetDateField}\` <= '${initialParams.end}T23:59:59'`
    );
  }

  const whereClause = conditions.join(" AND ");

  const sqlQuery = `SELECT
  *
WHERE ${whereClause}
ORDER BY \`${targetDateField}\` DESC`;

  return `${baseUrl}/${encodeURIComponent(sqlQuery)}/page/filter`;
}

export function buildFiltersFromParams({
  targetDateField,
  initialParams,
}: {
  targetDateField: PgColumn;
  initialParams: BuildingDashSearchParams;
}): SQL<unknown>[] {
  const { start, end, lat, lng, radius, permitTypeDesc, statusCurrent } =
    initialParams;
  const conditions = [isNotNull(targetDateField)];

  if (targetDateField.name === "completed_date") {
    conditions.push(gt(buildingPermits.housingUnitsAdded, 0));
  }

  if (permitTypeDesc) {
    conditions.push(eq(buildingPermits.permitTypeDesc, permitTypeDesc));
  }

  if (statusCurrent) {
    conditions.push(eq(buildingPermits.statusCurrent, statusCurrent));
  }

  if (start) {
    conditions.push(sql`${targetDateField} >= ${start}`);
  } else {
    conditions.push(
      sql`${targetDateField} >= ${new Date(DEFAULT_START_DATE).toISOString()}`
    );
  }
  if (end) {
    conditions.push(sql`${targetDateField} <= ${end}`);
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
  return conditions;
}
