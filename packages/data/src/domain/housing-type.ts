/**
 * Housing type classifier (SPEC §3, DEV_REWRITE_SPEC §4.7).
 *
 * One type per building permit that adds units. The City's `dwellingunittype` is used
 * when present; otherwise the type is inferred from housing category, permit class,
 * unit count and description keywords. Bump CLASSIFIER_VERSION when rules change.
 */

export const CLASSIFIER_VERSION = 3;

export const HOUSING_TYPES = [
  "detached",
  "adu",
  "townhouse",
  "mf_small",
  "mf_mid",
  "mf_large",
  "other",
] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  detached: "Detached house",
  adu: "ADU/DADU",
  townhouse: "Townhouse/rowhouse",
  mf_small: "Small multifamily",
  mf_mid: "Mid-size multifamily",
  mf_large: "Large multifamily",
  other: "Other/unknown",
};

/**
 * Multifamily size cutoffs by units added. Provisional: chosen to roughly separate
 * low-rise walk-ups, mid-rise, and high-rise / large podium buildings. Revisit with
 * the housing-type report.
 */
export const MF_MID_MIN_UNITS = 20;
export const MF_LARGE_MIN_UNITS = 150;

export type HousingTypeSource = "city" | "inferred";

export interface HousingTypeInput {
  permitTypeMapped: string;
  housingUnitsAdded: number | null;
  dwellingUnitType: string | null;
  housingCategory: string | null;
  permitClass: string | null;
  description: string | null;
}

function multifamilyBySize(units: number): HousingType {
  if (units >= MF_LARGE_MIN_UNITS) return "mf_large";
  if (units >= MF_MID_MIN_UNITS) return "mf_mid";
  return "mf_small";
}

const APARTMENT_TOKENS = [
  "apartment",
  "multifamily non-ground level dwelling",
  "multifamily ground level apartment",
  "multifamily other",
  "small efficiency dwelling",
  "congregate housing",
  "assisted living",
];
const TOWNHOUSE_TOKENS = [
  "townhouse",
  "rowhouse",
  "multifamily ground level townhouse",
  "multifamily ground level tandem dwelling",
  "cottage",
];
const ADU_TOKENS = ["accessory dwelling attached", "accessory dwelling detached", "accessory caretaker"];
const DETACHED_TOKENS = ["detached single-family"];

/** Classify from the City's dwelling unit type list, or null if it isn't informative. */
export function fromDwellingUnitType(value: string | null, units: number): HousingType | null {
  if (!value) return null;
  const tokens = value
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const has = (list: string[]) => tokens.some((t) => list.includes(t));

  if (has(APARTMENT_TOKENS)) return multifamilyBySize(units);
  if (has(TOWNHOUSE_TOKENS)) return "townhouse";
  // A new house built together with ADUs is counted as ADU: the ADUs are most of the units
  // and the policy-relevant part.
  if (has(ADU_TOKENS)) return "adu";
  if (has(DETACHED_TOKENS)) return "detached";
  return null; // live/work only, "Not Reviewed", "No Dwelling Units"
}

const RE_ADU = /\b(d?adus?|aadus?|accessory ?dwellings?|backyard cottages?|mother[- ]in[- ]law)\b/i;
const RE_TOWNHOUSE = /\b(town ?homes?|town ?houses?|row ?houses?|rowhomes?)\b/i;
const RE_DUPLEX = /\b(duplex(es)?|triplex(es)?|fourplex(es)?|two[- ]family|three[- ]family)\b/i;
const RE_APARTMENT = /\b(apartments?|apts?|mixed[- ]use|multi-?family|sedus?|congregate|units? (?:apartment|residential) building)\b/i;
const RE_DETACHED = /\b(single[- ]family|sfrs?\d*|sfd|one[- ]family)\b/i;

/** Infer a type when the City's dwelling type is missing. Rule order matters. */
export function inferHousingType(input: HousingTypeInput, units: number): HousingType {
  const category = input.housingCategory?.toLowerCase() ?? "";
  const singleFamilyClass = input.permitClass?.toLowerCase() === "single family/duplex";
  const multiClass = ["commercial", "multifamily"].includes(input.permitClass?.toLowerCase() ?? "");
  const description = input.description ?? "";
  const small = units <= 3;

  if (category === "pre-approved dadu plans") return "adu";
  if (category === "large multifamily") {
    return RE_TOWNHOUSE.test(description) && units < MF_MID_MIN_UNITS ? "townhouse" : multifamilyBySize(units);
  }

  // Descriptions often cover the whole site ("3 houses each with an ADU"), so unit counts
  // can exceed one house plus its ADUs.
  if (RE_ADU.test(description) && (singleFamilyClass || small)) return "adu";
  if (RE_TOWNHOUSE.test(description) || (RE_DUPLEX.test(description) && units < MF_MID_MIN_UNITS)) {
    return "townhouse";
  }
  if (RE_APARTMENT.test(description)) return multifamilyBySize(units);
  if (RE_DETACHED.test(description) && (singleFamilyClass || small)) return "detached";

  // Commercial-class permits that add housing are mixed-use buildings.
  if (multiClass && units >= 5) return multifamilyBySize(units);
  if (category === "single-family add/alt" && units <= 2) return "adu";
  if (category === "middle housing") return units === 1 ? "detached" : "townhouse";
  return "other";
}

const RE_SITE_PREP = /^\s*(phase\s+\w+\s*(of\s+\w+)?\s*[:-]?\s*)?(construct\s+|install\s+|temporary\s+)*(shoring|excavation)\b/i;
const RE_BUILDS_BUILDING = /\b(occupy|construction of (a )?new|construct new)\b/i;

/**
 * Shoring/excavation permits often restate the units of the building they prepare the site
 * for, without being linked to it (DEV_REWRITE_SPEC §4.5 double-counting audit). Their units
 * are counted on the building permit instead.
 */
export function isSitePrepOnly(description: string | null): boolean {
  if (!description) return false;
  return RE_SITE_PREP.test(description) && !RE_BUILDS_BUILDING.test(description);
}

export function classifyHousingType(
  input: HousingTypeInput,
): { housingType: HousingType; housingTypeSource: HousingTypeSource } | null {
  if (input.permitTypeMapped !== "Building") return null;
  const units = input.housingUnitsAdded ?? 0;
  if (units <= 0 || isSitePrepOnly(input.description)) return null;

  const fromCity = fromDwellingUnitType(input.dwellingUnitType, units);
  if (fromCity) return { housingType: fromCity, housingTypeSource: "city" };
  return { housingType: inferHousingType(input, units), housingTypeSource: "inferred" };
}
