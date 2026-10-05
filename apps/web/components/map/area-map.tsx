"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression } from "leaflet";
import { MapContainer, Polygon, TileLayer, Tooltip } from "react-leaflet";
import type { AreaOption } from "@/lib/server/permits";
import { FitToContainer, SEATTLE_BOUNDS } from "./permit-map";

const SELECTED = "#2563eb";
const IDLE = "#525252";

/** Community Reporting Areas on a map: hover for the name, click to select or deselect. */
export default function AreaMap({
  areas,
  selected,
  onToggle,
  className,
}: {
  areas: AreaOption[];
  selected: string[];
  onToggle: (id: string) => void;
  className?: string;
}) {
  return (
    <MapContainer
      bounds={SEATTLE_BOUNDS as LatLngBoundsExpression}
      maxBounds={SEATTLE_BOUNDS}
      maxBoundsViscosity={0.8}
      minZoom={10}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      className={className}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="grayscale"
      />
      {areas.map((a) => {
        const on = selected.includes(a.id);
        return (
          <Polygon
            key={`${a.id}-${on}`}
            positions={a.polygons}
            pathOptions={{
              color: on ? SELECTED : IDLE,
              weight: on ? 2 : 1,
              fillColor: on ? SELECTED : IDLE,
              fillOpacity: on ? 0.35 : 0.05,
            }}
            eventHandlers={{
              click: () => onToggle(a.id),
              mouseover: (e) => e.target.setStyle({ fillOpacity: on ? 0.45 : 0.2 }),
              mouseout: (e) => e.target.setStyle({ fillOpacity: on ? 0.35 : 0.05 }),
            }}
          >
            <Tooltip sticky>{a.name}</Tooltip>
          </Polygon>
        );
      })}
      <FitToContainer refit />
    </MapContainer>
  );
}
