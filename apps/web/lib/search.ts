/**
 * Place search (SPEC P2): matching names, informal names and districts. Pure, so the search
 * box (client) and the search page (server) rank places the same way.
 */
import type { PlaceKind } from "@sbt/data/domain/places";

export interface PlaceOption {
  id: string;
  kind: PlaceKind;
  name: string;
  district: string | null;
  aliases: string[];
  pipelineUnits: number;
}

/** Lowercase, drop punctuation and leading "the", and spell "Mount"/"Saint" the short way. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bmount\b/g, "mt")
    .replace(/\bsaint\b/g, "st")
    .replace(/^the\s+/, "")
    .trim();
}

/** Lower is better; null means no match. */
function score(query: string, option: PlaceOption): number | null {
  const q = normalize(query);
  if (!q) return null;
  const compact = q.replace(/\s+/g, "");
  const test = (text: string, base: number) => {
    const t = normalize(text);
    if (t === q || t.replace(/\s+/g, "") === compact) return base;
    if (t.startsWith(q)) return base + 1;
    if (` ${t}`.includes(` ${q}`)) return base + 2;
    return null;
  };
  const candidates = [
    test(option.name, 0),
    ...option.aliases.map((a) => test(a, 3)),
    option.district && option.kind === "neighborhood" ? test(option.district, 6) : null,
  ].filter((s): s is number => s !== null);
  return candidates.length ? Math.min(...candidates) : null;
}

export function matchPlaces(query: string, options: PlaceOption[], limitPerKind = 6) {
  const scored = options
    .map((o) => ({ o, s: score(query, o) }))
    .filter((x): x is { o: PlaceOption; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || b.o.pipelineUnits - a.o.pipelineUnits || a.o.name.localeCompare(b.o.name));
  const of = (kind: PlaceKind) =>
    scored
      .filter((x) => x.o.kind === kind)
      .slice(0, limitPerKind)
      .map((x) => x.o);
  return { neighborhoods: of("neighborhood"), centers: of("center") };
}

/** Whether the text looks like an address or street rather than a place name. */
export function looksLikeAddress(query: string): boolean {
  const q = query.trim();
  return /^\d+\s+\S/.test(q) || /\b(st|ave|avenue|street|way|blvd|pl|rd|dr|ct|ln)\b/i.test(q);
}

export const KIND_LABELS: Record<PlaceKind, string> = { neighborhood: "Neighborhood", center: "Growth center" };
export const KIND_GROUP_LABELS: Record<PlaceKind, string> = { neighborhood: "Neighborhoods", center: "Urban villages and centers" };
