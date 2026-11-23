import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { PlaceReport } from "@/components/place-report";
import { placeHref } from "@/lib/filters";
import { DEFAULT_RADIUS_MILES, RADIUS_MILES, radiusLabel } from "@/lib/rules";
import { getPlacesAt } from "@/lib/server/places";
import { reportCache } from "@/lib/server/search-params";
import { getToday } from "@/lib/server/today";

function safeDecode(s: string): string | null {
  try {
    const v = decodeURIComponent(s).trim();
    return v && v.length <= 120 ? v : null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ label: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { r } = await reportCache.parse(searchParams);
  return { title: `${radiusLabel(r ?? DEFAULT_RADIUS_MILES)} around ${safeDecode((await params).label) ?? "a point"}` };
}

/** P3 for a radius around an address or point: /near/<address>?lat=…&lng=…&r=0.5 (SPEC T7). */
export default async function NearPage({ params, searchParams }: Props) {
  const label = safeDecode((await params).label);
  if (!label) notFound();
  const settings = await reportCache.parse(searchParams);
  const { lat, lng } = settings;
  const r = settings.r ?? DEFAULT_RADIUS_MILES;
  if (lat == null || lng == null) notFound();
  const today = await getToday(settings.asof);
  const related = await getPlacesAt(lat, lng);
  const href = (miles: number, s: Parameters<typeof placeHref>[1] = {}) => placeHref({ lat, lng, r: miles, label }, s);
  return (
    <PlaceReport
      today={today}
      settings={settings}
      place={{
        name: `${radiusLabel(r)} around ${label}`,
        kindLabel: "Within a radius",
        where: { lat, lng, r },
        circle: { lat, lng, miles: r },
        center: { lat, lng },
        radiusLabel: label,
        related,
        hrefWith: (s) => href(r, s),
        radii: RADIUS_MILES.map((miles) => ({ miles, href: href(miles, { year: settings.year, asof: settings.asof }) })),
      }}
    />
  );
}
