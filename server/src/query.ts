import { BuildingDashSearchParams } from "@/app/PermitRowFilters";
import { buildingPermits } from "@/server/src/db/schema";
import { DEFAULT_DATE_FIELD } from "@/utils";
import { eq, gt, isNotNull, sql, SQL } from "drizzle-orm";

export const DEFAULT_START_DATE = "2010-01-01";

export type StatusCategory = "pipeline" | "done" | "canceled";

export function categorizeStatus(statusCurrent: string | null): StatusCategory {
  if (!statusCurrent) return "pipeline";

  const status = statusCurrent.toLowerCase();

  // Done: completed states (construction actually finished)
  if (
    status === "completed" ||
    status === "closed" ||
    status === "approved to occupy" ||
    status === "inspections completed"
  ) {
    return "done";
  }

  // Canceled: terminal non-completion states
  if (
    status === "canceled" ||
    status === "denied" ||
    status === "expired" ||
    status === "withdrawn"
  ) {
    return "canceled";
  }

  // Pipeline: everything else (in progress, pending, issued, application completed, etc.)
  return "pipeline";
}

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

export function dateFieldFromParams(params: BuildingDashSearchParams) {
  const dateField = params.dateField;
  switch (dateField) {
    case "applied": {
      return buildingPermits.appliedDate;
    }
    case "completed": {
      return buildingPermits.completedDate;
    }
    case undefined: {
      if (DEFAULT_DATE_FIELD === "applied") {
        return buildingPermits.appliedDate;
      } else {
        // wonky
        return buildingPermits.completedDate;
      }
    }
    default: {
      const _exhaustive: never = dateField;
      throw new Error(`unrecognized date field ${_exhaustive}`);
    }
  }
}

export function buildFiltersFromParams(
  initialParams: BuildingDashSearchParams
): SQL<unknown>[] {
  const {
    start,
    end,
    lat,
    lng,
    radius,
    permitTypeDesc,
    statusCurrent,
    housingUnitsAddedMin,
    dateField,
  } = initialParams;

  // Determine which date field to use
  const targetDateField = dateFieldFromParams(initialParams);

  const conditions = [isNotNull(targetDateField)];

  if (dateField === "completed") {
    conditions.push(gt(buildingPermits.housingUnitsAdded, 0));
  }

  if (permitTypeDesc) {
    conditions.push(eq(buildingPermits.permitTypeDesc, permitTypeDesc));
  }

  if (statusCurrent) {
    // Handle status category filtering
    if (statusCurrent === "pipeline") {
      conditions.push(
        sql`LOWER(${buildingPermits.statusCurrent}) NOT IN ('completed', 'closed', 'approved to occupy', 'inspections completed', 'canceled', 'denied', 'expired', 'withdrawn')`
      );
    } else if (statusCurrent === "done") {
      conditions.push(
        sql`LOWER(${buildingPermits.statusCurrent}) IN ('completed', 'closed', 'approved to occupy', 'inspections completed')`
      );
    } else if (statusCurrent === "canceled") {
      conditions.push(
        sql`LOWER(${buildingPermits.statusCurrent}) IN ('canceled', 'denied', 'expired', 'withdrawn')`
      );
    }
  }

  if (housingUnitsAddedMin) {
    const minUnits = parseInt(housingUnitsAddedMin, 10);
    if (!isNaN(minUnits)) {
      conditions.push(sql`${buildingPermits.housingUnitsAdded} >= ${minUnits}`);
    }
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
