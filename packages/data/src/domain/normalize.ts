import { createHash } from "node:crypto";
import type { permitsStaging } from "../db/schema";
import { classifyHousingType, isSitePrepOnly } from "./housing-type";
import { classifyStatus } from "./status";

/** A row from the Seattle Open Data Building Permits dataset (76t5-zqzr). All values are strings. */
export interface SourceRecord {
  ":id"?: string;
  permitnum: string;
  permitclass?: string;
  permitclassmapped?: string;
  permittypemapped?: string;
  permittypedesc?: string;
  description?: string;
  housingunits?: string;
  housingunitsremoved?: string;
  housingunitsadded?: string;
  estprojectcost?: string;
  applieddate?: string;
  issueddate?: string;
  expiresdate?: string;
  completeddate?: string;
  initialreviewcompletedate?: string;
  planreviewcompletedate?: string;
  readytoissuedate?: string;
  statuscurrent?: string;
  relatedmup?: string;
  parentpermitnum?: string;
  development_site?: string;
  originaladdress1?: string;
  originalcity?: string;
  originalstate?: string;
  originalzip?: string;
  latitude?: string;
  longitude?: string;
  zoning?: string;
  contractorcompanyname?: string;
  link?: { url?: string } | string;
  totaldaysplanreview?: string;
  daysinitialplanreview?: string;
  daysplanreviewcity?: string;
  daysoutcorrections?: string;
  numberreviewcycles?: string;
  daysissuepermitcity?: string;
  dwellingunittype?: string;
  housingcategory?: string;
  standardplan?: string;
  dependentbuilding?: string;
}

export type StagingRow = typeof permitsStaging.$inferInsert;

/**
 * Dates before this are placeholders (the City uses 1900-01-01 for "unknown") and are
 * stored as null.
 */
const EARLIEST_REAL_DATE = "1950-01-01";

export function parseDate(value?: string): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (day < EARLIEST_REAL_DATE) return null;
  return day;
}

export function parseInteger(value?: string): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseNumber(value?: string): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseBoolean(value?: string): boolean | null {
  if (value === "1" || value?.toLowerCase() === "true") return true;
  if (value === "0" || value?.toLowerCase() === "false") return false;
  return null;
}

function text(value?: string): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** Seattle's bounding box, with margin. Coordinates outside it are treated as missing. */
function plausibleCoordinates(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return { latitude: null, longitude: null };
  if (lat < 47.4 || lat > 47.8 || lng < -122.5 || lng > -122.2) {
    return { latitude: null, longitude: null };
  }
  return { latitude: lat, longitude: lng };
}

function hashRow(row: Omit<StagingRow, "contentHash" | "sourceRowId">): string {
  return createHash("sha1").update(JSON.stringify(row)).digest("hex");
}

export function normalizeRecord(r: SourceRecord): StagingRow {
  const appliedDate = parseDate(r.applieddate);
  const issuedDate = parseDate(r.issueddate);
  const statusCurrent = text(r.statuscurrent);
  const permitTypeMapped = text(r.permittypemapped) ?? "Unknown";
  const housingUnitsAdded = parseInteger(r.housingunitsadded);
  const developmentSite = text(r.development_site);
  const link = typeof r.link === "string" ? r.link : (r.link?.url ?? null);

  const fields = {
    permitNum: r.permitnum,
    permitClass: text(r.permitclass),
    permitClassMapped: text(r.permitclassmapped),
    permitTypeMapped,
    permitTypeDesc: text(r.permittypedesc),
    description: text(r.description),
    housingUnits: parseInteger(r.housingunits),
    housingUnitsRemoved: parseInteger(r.housingunitsremoved),
    housingUnitsAdded,
    estProjectCost: parseNumber(r.estprojectcost)?.toFixed(2) ?? null,
    appliedDate,
    issuedDate,
    expiresDate: parseDate(r.expiresdate),
    completedDate: parseDate(r.completeddate),
    initialReviewCompleteDate: parseDate(r.initialreviewcompletedate),
    planReviewCompleteDate: parseDate(r.planreviewcompletedate),
    readyToIssueDate: parseDate(r.readytoissuedate),
    statusCurrent,
    relatedMup: text(r.relatedmup),
    parentPermitNum: text(r.parentpermitnum),
    developmentSite,
    address: text(r.originaladdress1),
    city: text(r.originalcity),
    state: text(r.originalstate),
    zip: text(r.originalzip),
    ...plausibleCoordinates(parseNumber(r.latitude), parseNumber(r.longitude)),
    zoning: text(r.zoning),
    contractorCompanyName: text(r.contractorcompanyname),
    link,
    totalDaysPlanReview: parseInteger(r.totaldaysplanreview),
    daysInitialPlanReview: parseInteger(r.daysinitialplanreview),
    daysPlanReviewCity: parseInteger(r.daysplanreviewcity),
    daysOutCorrections: parseInteger(r.daysoutcorrections),
    numberReviewCycles: parseInteger(r.numberreviewcycles),
    daysIssuePermitCity: parseInteger(r.daysissuepermitcity),
    dwellingUnitType: text(r.dwellingunittype),
    housingCategory: text(r.housingcategory),
    standardPlan: parseBoolean(r.standardplan),
    dependentBuilding: parseBoolean(r.dependentbuilding),
  };

  const status = classifyStatus({ statusCurrent, appliedDate, issuedDate });
  const housing = classifyHousingType({
    permitTypeMapped,
    housingUnitsAdded,
    dwellingUnitType: fields.dwellingUnitType,
    housingCategory: fields.housingCategory,
    permitClass: fields.permitClass,
    description: fields.description,
  });

  const row = {
    ...fields,
    sitePrepOnly: permitTypeMapped === "Building" && isSitePrepOnly(fields.description),
    ...status,
    housingType: housing?.housingType ?? null,
    housingTypeSource: housing?.housingTypeSource ?? null,
    projectKey: developmentSite ?? r.permitnum,
  };
  return { ...row, sourceRowId: r[":id"] ?? null, contentHash: hashRow(row) };
}
