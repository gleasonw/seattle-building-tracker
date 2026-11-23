import type { Metadata } from "next";
import Link from "next/link";
import {
  createSearchParamsCache,
  parseAsString,
  type SearchParams,
} from "nuqs/server";
import { PlaceSearch } from "@/components/place-search";
import { Section } from "@/components/section";
import { StageBadge } from "@/components/stage-badge";
import { placeHref, projectHref, type Stage } from "@/lib/filters";
import { formatNumber, unitsCount } from "@/lib/format";
import { DEFAULT_RADIUS_MILES, radiusLabel } from "@/lib/rules";
import { KIND_GROUP_LABELS, matchPlaces, type PlaceOption } from "@/lib/search";
import { geocode } from "@/lib/server/geocode";
import {
  getProjectsNear,
  listPlaceOptions,
  searchProjectAddresses,
} from "@/lib/server/places";
import { getToday } from "@/lib/server/today";

export const metadata: Metadata = { title: "Places" };

const cache = createSearchParamsCache({ q: parseAsString.withDefault("") });

function PlaceLink({ p }: { p: PlaceOption }) {
  return (
    <Link
      href={placeHref(p)}
      className="hover:bg-muted flex min-h-13 items-center gap-3 rounded-lg px-3 py-1.5"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{p.name}</span>
        <span className="text-muted-foreground truncate text-[13px]">
          {p.kind === "neighborhood"
            ? `Neighborhood · ${p.district}`
            : `${p.district} · Comprehensive Plan`}
          {p.aliases.length > 0 &&
            ` · also ${p.aliases.slice(0, 3).join(", ")}`}
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-right text-[13px] tabular-nums">
        {unitsCount(p.pipelineUnits)} in pipeline
      </span>
    </Link>
  );
}

/** P2: find a place by name, informal name or address. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q } = await cache.parse(searchParams);
  const today = await getToday();
  const query = q.trim();
  const [places, geocoded, byAddress] = await Promise.all([
    listPlaceOptions(today),
    query ? geocode(query) : [],
    query.length >= 3 ? searchProjectAddresses(query, today) : [],
  ]);
  const matches = query ? matchPlaces(query, places, 20) : null;
  const addresses = geocoded.filter((g) => g.kind === "address");
  const streets = geocoded.filter((g) => g.kind === "street");
  const atAddress = await Promise.all(
    addresses.slice(0, 3).map((a) => getProjectsNear(a.lat, a.lng, today)),
  );

  return (
    <>
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">Places</h1>
        <p className="text-muted-foreground">
          Find a neighborhood, an urban village or center from the Comprehensive
          Plan, or the area around an address. Common names work too: “U
          District”, “Capitol Hill”, “the Junction”.
        </p>
        <label htmlFor="place-search" className="pt-2 text-sm font-semibold">
          How&apos;s it going in…
        </label>
        <PlaceSearch places={places} initialQuery={query} autoFocus={!query} />
      </div>

      {matches && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(matches.neighborhoods.length > 0 || !geocoded.length) && (
            <Section title={KIND_GROUP_LABELS.neighborhood}>
              {matches.neighborhoods.length ? (
                <div className="-mx-3 flex flex-col">
                  {matches.neighborhoods.map((p) => (
                    <PlaceLink key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No neighborhood by that name.
                </p>
              )}
            </Section>
          )}
          {(matches.centers.length > 0 || !geocoded.length) && (
            <Section title={KIND_GROUP_LABELS.center}>
              {matches.centers.length ? (
                <div className="-mx-3 flex flex-col">
                  {matches.centers.map((p) => (
                    <PlaceLink key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No urban village or center by that name.
                </p>
              )}
            </Section>
          )}
          <Section
            title="Addresses and streets"
            className="lg:col-span-2"
            description="Addresses from the City's geocoder. Each offers the projects at that address and a report on the area around it."
          >
            {addresses.length === 0 &&
              streets.length === 0 &&
              byAddress.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No Seattle address or street matches “{query}”.
                </p>
              )}
            <ul className="flex flex-col gap-4">
              {addresses.slice(0, 3).map((a, i) => (
                <li
                  key={`${a.label}-${a.zip}`}
                  className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold">
                      {a.label}{" "}
                      <span className="text-muted-foreground font-normal">
                        · Seattle {a.zip}
                      </span>
                    </span>
                    <Link
                      href={placeHref({
                        lat: a.lat,
                        lng: a.lng,
                        r: DEFAULT_RADIUS_MILES,
                        label: a.label,
                      })}
                      className="text-primary text-sm font-medium"
                    >
                      Report on the {radiusLabel(DEFAULT_RADIUS_MILES)} around
                      it →
                    </Link>
                  </div>
                  {atAddress[i]!.length ? (
                    <ul className="flex flex-col gap-1">
                      {atAddress[i]!.map((p) => (
                        <li
                          key={p.mainPermit}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <StageBadge stage={p.stage as Stage} />
                          <Link
                            href={projectHref(p.mainPermit)}
                            className="text-primary hover:underline"
                          >
                            {p.address ?? p.mainPermit}
                          </Link>
                          <span className="text-muted-foreground">
                            · {formatNumber(p.units)}-unit project
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No housing projects recorded at this address.
                    </p>
                  )}
                </li>
              ))}
              {streets.slice(0, 4).map((s) => (
                <li
                  key={`${s.label}-${s.zip}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 first:border-t-0"
                >
                  <span className="text-[15px] font-semibold">
                    {s.label}{" "}
                    <span className="text-muted-foreground font-normal">
                      · Street, Seattle {s.zip}
                    </span>
                  </span>
                  <Link
                    href={placeHref({
                      lat: s.lat,
                      lng: s.lng,
                      r: 0.25,
                      label: `${s.label} (${s.zip})`,
                    })}
                    className="text-primary text-sm font-medium"
                  >
                    Report on the {radiusLabel(0.25)} around it →
                  </Link>
                </li>
              ))}
            </ul>
            {byAddress.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-3">
                <span className="text-muted-foreground text-[13px] font-semibold tracking-wide uppercase">
                  Projects with matching addresses
                </span>
                {byAddress.map((p) => (
                  <div
                    key={p.mainPermit}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <StageBadge stage={p.stage as Stage} />
                    <Link
                      href={projectHref(p.mainPermit)}
                      className="text-primary hover:underline"
                    >
                      {p.address ?? p.mainPermit}
                    </Link>
                    <span className="text-muted-foreground">
                      · {formatNumber(p.units)}-unit project
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {!matches && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            title={KIND_GROUP_LABELS.neighborhood}
            description="From the City Clerk's Neighborhood Map Atlas. They cover the city without overlapping."
          >
            <div className="-mx-3 flex flex-col">
              {places
                .filter((p) => p.kind === "neighborhood")
                .map((p) => (
                  <PlaceLink key={p.id} p={p} />
                ))}
            </div>
          </Section>
          <Section
            title={KIND_GROUP_LABELS.center}
            description="Where the Comprehensive Plan directs growth. They overlap neighborhoods."
          >
            <div className="-mx-3 flex flex-col">
              {places
                .filter((p) => p.kind === "center")
                .map((p) => (
                  <PlaceLink key={p.id} p={p} />
                ))}
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
