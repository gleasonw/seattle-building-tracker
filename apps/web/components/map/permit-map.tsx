"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { formatDate, formatNumber } from "@/lib/format";
import type { MapPoint } from "@/lib/server/map";

export const SEATTLE_BOUNDS: LatLngBoundsExpression = [
  [47.495, -122.436],
  [47.735, -122.236],
];
const MILES_TO_METERS = 1609.344;

/** Marker radius in pixels: area proportional to units, so a 400-unit tower reads as 20× a duplex. */
const markerRadius = (units: number) => Math.max(2, Math.min(20, 1.2 * Math.sqrt(units)));

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))) });
  return null;
}

/** Re-measure when the container resizes (e.g. inside an animating popover) and refit if nothing is selected. */
export function FitToContainer({ refit }: { refit: boolean }) {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (refit) map.fitBounds(SEATTLE_BOUNDS);
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, refit]);
  return null;
}

export interface PermitMapProps {
  points?: MapPoint[];
  radius?: { lat: number; lng: number; miles: number } | null;
  /** When set, clicking the map picks a point (e.g. the centre of a radius filter). */
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}

/** Permits sized by units (SPEC X4): units added in blue, units removed in red. */
export default function PermitMap({ points = [], radius, onPick, className }: PermitMapProps) {
  const view = radius
    ? { center: [radius.lat, radius.lng] as LatLngExpression, zoom: radius.miles > 1 ? 13 : 14 }
    : { bounds: SEATTLE_BOUNDS };
  return (
    <MapContainer
      {...view}
      maxBounds={SEATTLE_BOUNDS}
      maxBoundsViscosity={0.8}
      minZoom={10}
      zoomSnap={0.25}
      preferCanvas
      scrollWheelZoom={false}
      className={className}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="grayscale"
      />
      {radius && (
        <Circle
          center={[radius.lat, radius.lng]}
          radius={radius.miles * MILES_TO_METERS}
          pathOptions={{ color: "#262626", weight: 1.5, dashArray: "4 4", fillOpacity: 0.04 }}
        />
      )}
      {points.map((p) => {
        const removal = p.added === 0 && p.removed > 0;
        const units = removal ? p.removed : p.added;
        const color = removal ? "oklch(0.64 0.19 25)" : "oklch(0.5 0.15 255)";
        return (
          <CircleMarker
            key={p.permitNum}
            center={[p.lat, p.lng]}
            radius={markerRadius(units)}
            pathOptions={{ color, weight: 0.75, fillColor: color, fillOpacity: 0.35 }}
          >
            <Popup>
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-medium">{p.address ?? p.permitNum}</span>
                <span>
                  {p.added > 0 && `+${formatNumber(p.added)} units`}
                  {p.added > 0 && p.removed > 0 && ", "}
                  {p.removed > 0 && `−${formatNumber(p.removed)} removed`} · {formatDate(p.date)}
                </span>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer">
                    {p.permitNum} on the City&apos;s site
                  </a>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      {onPick && <ClickToPick onPick={onPick} />}
      <FitToContainer refit={!radius} />
    </MapContainer>
  );
}
