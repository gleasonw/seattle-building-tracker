"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { formatNumber } from "@/lib/format";

export const SEATTLE_BOUNDS: LatLngBoundsExpression = [
  [47.49, -122.44],
  [47.74, -122.23],
];
const MILES_TO_METERS = 1609.344;

export interface MapProject {
  key: string;
  lat: number;
  lng: number;
  units: number;
  /** Pipeline maps: in review or issued. Past-year maps: completed that year, or applied for that year. */
  kind: "review" | "issued" | "completed" | "applied";
  stalled: boolean;
  address: string;
  href: string;
}

export interface PlaceMapProps {
  polygons?: [number, number][][][];
  circle?: { lat: number; lng: number; miles: number };
  projects: MapProject[];
  className?: string;
}

/** Marker radius in pixels: area proportional to units. */
const markerRadius = (units: number) => Math.max(3, Math.min(22, 1.4 * Math.sqrt(units)));

const COLORS = {
  issued: "var(--stage-issued)",
  completed: "var(--stage-issued)",
  review: "var(--stage-review)",
  applied: "var(--stage-review)",
  stalled: "var(--stage-stalled)",
};
const KIND_LABELS = { issued: "Issued", review: "In review", completed: "Completed that year", applied: "Applied for that year" };

function Fit({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [16, 16] });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, bounds]);
  return null;
}

/** A place's boundary with its projects (pipeline, or a past year's), colored by kind and sized by units (SPEC P3). */
export default function PlaceMap({ polygons, circle, projects, className }: PlaceMapProps) {
  let bounds: LatLngBoundsExpression = SEATTLE_BOUNDS;
  if (polygons?.length) {
    const pts = polygons.flat(2);
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    bounds = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  } else if (circle) {
    const dLat = (circle.miles * MILES_TO_METERS) / 111_320;
    const dLng = dLat / Math.cos((circle.lat * Math.PI) / 180);
    bounds = [
      [circle.lat - dLat, circle.lng - dLng],
      [circle.lat + dLat, circle.lng + dLng],
    ];
  }
  // Largest first, so small markers stay clickable on top.
  const sorted = [...projects].sort((a, b) => b.units - a.units);
  return (
    <MapContainer bounds={bounds} scrollWheelZoom={false} zoomSnap={0.25} className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="grayscale"
      />
      {polygons && (
        <Polygon
          positions={polygons}
          pathOptions={{ color: "var(--primary)", weight: 2, dashArray: "6 4", fillColor: "var(--primary)", fillOpacity: 0.06 }}
        />
      )}
      {circle && (
        <Circle
          center={[circle.lat, circle.lng] as LatLngExpression}
          radius={circle.miles * MILES_TO_METERS}
          pathOptions={{ color: "var(--primary)", weight: 2, dashArray: "6 4", fillOpacity: 0.05 }}
        />
      )}
      {sorted.map((p) => (
        <CircleMarker
          key={p.key}
          center={[p.lat, p.lng]}
          radius={markerRadius(p.units)}
          pathOptions={{
            color: p.stalled ? COLORS.stalled : "#fff",
            weight: p.stalled ? 2.5 : 1.5,
            fillColor: COLORS[p.kind],
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <div className="flex flex-col gap-0.5 text-xs">
              <a href={p.href} className="font-semibold">
                {p.address}
              </a>
              <span>
                {formatNumber(p.units)} {p.units === 1 ? "unit" : "units"} · {KIND_LABELS[p.kind]}
                {p.stalled && " · Stalled"}
              </span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      <Fit bounds={bounds} />
    </MapContainer>
  );
}
