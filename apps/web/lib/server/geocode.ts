import "server-only";

/**
 * The City of Seattle's public geocoder (no key). Used only by the search page, server side.
 * https://gisdata.seattle.gov/cosgis/rest/services/locators/MultiRoles/GeocodeServer
 */
const GEOCODER = "https://gisdata.seattle.gov/cosgis/rest/services/locators/MultiRoles/GeocodeServer/findAddressCandidates";

export interface GeocodeResult {
  /** e.g. "6716 Roosevelt Way NE" or "Roosevelt Way NE". */
  label: string;
  kind: "address" | "street";
  lat: number;
  lng: number;
  zip: string | null;
}

/** "6716 ROOSEVELT WAY NE, SEATTLE, WA, 98115" → "6716 Roosevelt Way NE". */
export function tidyAddress(raw: string): { label: string; zip: string | null } {
  const [street = raw, , , zip] = raw.split(",").map((s) => s.trim());
  const label = street
    .toLowerCase()
    .split(/\s+/)
    .map((w) =>
      /^(n|s|e|w|ne|nw|se|sw)$/.test(w)
        ? w.toUpperCase()
        : /^\d+(st|nd|rd|th)$/.test(w)
          ? w
          : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
  return { label, zip: zip ?? null };
}

export async function geocode(q: string): Promise<GeocodeResult[]> {
  const url = new URL(GEOCODER);
  url.searchParams.set("SingleLine", q);
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("maxLocations", "6");
  url.searchParams.set("f", "json");
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      candidates?: { address: string; score: number; location: { x: number; y: number } }[];
    };
    const seen = new Set<string>();
    const out: GeocodeResult[] = [];
    for (const c of body.candidates ?? []) {
      if (c.score < 80) continue;
      const { label, zip } = tidyAddress(c.address);
      const key = `${label}|${zip}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, zip, kind: /^\d/.test(label) ? "address" : "street", lat: c.location.y, lng: c.location.x });
    }
    return out;
  } catch {
    return [];
  }
}
