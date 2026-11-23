import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { PlaceReport } from "@/components/place-report";
import { placeHref } from "@/lib/filters";
import { KIND_LABELS } from "@/lib/search";
import { getPlace, getRelatedPlaces } from "@/lib/server/places";
import { reportCache } from "@/lib/server/search-params";
import { getToday } from "@/lib/server/today";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await getPlace((await params).id);
  return { title: place?.name ?? "Place not found" };
}

/** P3 for a neighborhood or center. The link reads as the place's name (SPEC T7). */
export default async function PlacePage({ params, searchParams }: Props) {
  const { id } = await params;
  const settings = await reportCache.parse(searchParams);
  const today = await getToday(settings.asof);
  const [place, related] = await Promise.all([getPlace(id), getRelatedPlaces(id)]);
  if (!place) notFound();
  return (
    <PlaceReport
      today={today}
      settings={settings}
      place={{
        name: place.name,
        kindLabel: place.kind === "neighborhood" ? `${KIND_LABELS.neighborhood} · ${place.district}` : `${place.district} · Comprehensive Plan`,
        where: place.kind === "neighborhood" ? { hood: place.id } : { center: place.id },
        polygons: place.polygons,
        center: place.center,
        radiusLabel: place.name,
        related,
        hrefWith: (s) => placeHref(place, s),
      }}
    />
  );
}
