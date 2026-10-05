import { fromDwellingUnitType, HOUSING_TYPES, inferHousingType, type HousingType } from "./housing-type";

export interface AccuracyInput {
  permitTypeMapped: string;
  housingUnitsAdded: number;
  dwellingUnitType: string;
  housingCategory: string | null;
  permitClass: string | null;
  description: string | null;
}

export interface TypeAccuracy {
  type: HousingType;
  permits: number;
  units: number;
  recallUnits: number | null;
  precisionUnits: number | null;
}

export interface AccuracyReport {
  compared: number;
  permitAccuracy: number;
  unitAccuracy: number;
  byType: TypeAccuracy[];
  confusion: Record<HousingType, Record<HousingType, { permits: number; units: number }>>;
}

/**
 * Hide the City's dwelling type on permits that have one, infer the type, and compare
 * (DEV_REWRITE_SPEC §4.7). Shared by the report script and the methodology page.
 */
export function measureInferenceAccuracy(rows: AccuracyInput[]): AccuracyReport {
  const confusion = Object.fromEntries(
    HOUSING_TYPES.map((t) => [t, Object.fromEntries(HOUSING_TYPES.map((u) => [u, { permits: 0, units: 0 }]))]),
  ) as AccuracyReport["confusion"];

  let compared = 0;
  for (const r of rows) {
    const units = r.housingUnitsAdded;
    const truth = fromDwellingUnitType(r.dwellingUnitType, units);
    if (!truth) continue;
    const guess = inferHousingType({ ...r, dwellingUnitType: null }, units);
    confusion[truth][guess].permits++;
    confusion[truth][guess].units += units;
    compared++;
  }

  const sum = (f: (t: HousingType) => number) => HOUSING_TYPES.reduce((a, t) => a + f(t), 0);
  const ratio = (n: number, d: number) => (d === 0 ? null : n / d);

  const byType = HOUSING_TYPES.map((t) => {
    const truthUnits = sum((g) => confusion[t][g].units);
    const guessUnits = sum((g) => confusion[g][t].units);
    return {
      type: t,
      permits: sum((g) => confusion[t][g].permits),
      units: truthUnits,
      recallUnits: ratio(confusion[t][t].units, truthUnits),
      precisionUnits: ratio(confusion[t][t].units, guessUnits),
    };
  });

  const correctPermits = sum((t) => confusion[t][t].permits);
  const correctUnits = sum((t) => confusion[t][t].units);
  const totalUnits = sum((t) => byType.find((b) => b.type === t)!.units);
  return {
    compared,
    permitAccuracy: ratio(correctPermits, compared) ?? 0,
    unitAccuracy: ratio(correctUnits, totalUnits) ?? 0,
    byType,
    confusion,
  };
}
