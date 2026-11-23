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

/** A matching place, with the informal name that matched when it wasn't the place's own. */
export type PlaceMatch = PlaceOption & { matchedAlias?: string };

/** Edit distance allowing adjacent swaps (optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Typos allowed for a query of this length: none for short ones, so "cd" doesn't match "id". */
const typoBudget = (q: string) => (q.length < 4 ? 0 : q.length < 7 ? 1 : 2);

interface Scored {
  s: number;
  alias?: string;
}

/**
 * Lower is better; null means no match. Exact names beat exact informal names, which beat
 * names starting with the query. An informal name matches only whole or from its start, so
 * "Capitol Hill" doesn't pull in every place whose alias merely contains it ("North Capitol
 * Hill"). The district is a last resort (see matchPlaces).
 */
function score(q: string, option: PlaceOption): Scored | null {
  const compact = q.replace(/\s+/g, "");
  const exact = (t: string) => t === q || t.replace(/\s+/g, "") === compact;
  const best: Scored[] = [];
  const name = normalize(option.name);
  if (exact(name)) best.push({ s: 0 });
  else if (name.startsWith(q)) best.push({ s: 2 });
  else if (` ${name}`.includes(` ${q}`)) best.push({ s: 4 });
  for (const alias of option.aliases) {
    const t = normalize(alias);
    if (exact(t)) best.push({ s: 1, alias });
    else if (t.startsWith(q)) best.push({ s: 3, alias });
  }
  if (option.district && option.kind === "neighborhood" && normalize(option.district).startsWith(q)) best.push({ s: 6 });
  return best.length ? best.reduce((a, b) => (b.s < a.s ? b : a)) : null;
}

/** For a query that matched nothing: names and informal names within a typo or two. */
function fuzzyScore(q: string, option: PlaceOption): Scored | null {
  const budget = typoBudget(q.replace(/\s+/g, ""));
  if (!budget) return null;
  const distance = (text: string) => {
    const t = normalize(text);
    // Whole name, or its start, so a half-typed "roosvel" still finds Roosevelt.
    return Math.min(editDistance(q, t), editDistance(q, t.slice(0, q.length)));
  };
  const options: Scored[] = [{ s: distance(option.name) }, ...option.aliases.map((alias) => ({ s: distance(alias), alias }))];
  const best = options.reduce((a, b) => (b.s < a.s ? b : a));
  return best.s <= budget ? best : null;
}

export function matchPlaces(query: string, options: PlaceOption[], limitPerKind = 6) {
  const q = normalize(query);
  const run = (fn: (q: string, o: PlaceOption) => Scored | null) =>
    q
      ? options
          .map((o) => ({ o, m: fn(q, o) }))
          .filter((x): x is { o: PlaceOption; m: Scored } => x.m !== null)
      : [];
  let scored = run(score);
  // A neighborhood is listed for its district ("Capitol Hill" → Madison Park) only when no
  // place goes by that name, so a resident doesn't get the whole district.
  if (scored.some((x) => x.m.s < 6)) scored = scored.filter((x) => x.m.s < 6);
  if (!scored.length) scored = run(fuzzyScore);
  scored.sort((a, b) => a.m.s - b.m.s || b.o.pipelineUnits - a.o.pipelineUnits || a.o.name.localeCompare(b.o.name));
  const of = (kind: PlaceKind): PlaceMatch[] =>
    scored
      .filter((x) => x.o.kind === kind)
      .slice(0, limitPerKind)
      .map((x) => (x.m.alias ? { ...x.o, matchedAlias: x.m.alias } : x.o));
  return { neighborhoods: of("neighborhood"), centers: of("center") };
}

/** The line under a place's name in search results. */
export function placeSubtitle(p: PlaceMatch): string {
  const base = p.kind === "neighborhood" ? `Neighborhood · ${p.district}` : `${p.district} · Comprehensive Plan`;
  // Not when it only repeats the district ("Neighborhood · Capitol Hill · also called Capitol Hill").
  const repeats = p.matchedAlias && p.district && normalize(p.matchedAlias) === normalize(p.district);
  return p.matchedAlias && !repeats ? `${base} · also called ${p.matchedAlias}` : base;
}

/** Whether the text looks like an address or street rather than a place name. */
export function looksLikeAddress(query: string): boolean {
  const q = query.trim();
  return /^\d+\s+\S/.test(q) || /\b(st|ave|avenue|street|way|blvd|pl|rd|dr|ct|ln)\b/i.test(q);
}

export const KIND_LABELS: Record<PlaceKind, string> = { neighborhood: "Neighborhood", center: "Growth center" };
export const KIND_GROUP_LABELS: Record<PlaceKind, string> = { neighborhood: "Neighborhoods", center: "Urban villages and centers" };
