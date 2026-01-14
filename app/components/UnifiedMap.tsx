"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { categorizeStatus, StatusCategory } from "@/server/src/query";
import { useFilters } from "@/app/hooks/useFilters";
import { useDebounceCallback } from "usehooks-ts";

// Fix default marker icon issue with Webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Create colored marker icons
const pipelineIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const doneIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const canceledIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Record {
  latitude: string | null;
  longitude: string | null;
  originalAddress1: string | null;
  permitNum: string;
  appliedDate: string | null;
  completedDate: string | null;
  statusCurrent: string | null;
  housingUnitsAdded: number | null;
  link: string | null;
}

interface Cluster {
  neighborhood: string | null;
  count: number;
  centerLat: number;
  centerLng: number;
  pipelineCount: number;
  doneCount: number;
  canceledCount: number;
}

interface UnifiedMapProps {
  records?: Record[];
  clusters?: Cluster[];
  isCluster?: boolean;
}

function getIconForStatus(status: StatusCategory): L.Icon {
  switch (status) {
    case "pipeline":
      return pipelineIcon;
    case "done":
      return doneIcon;
    case "canceled":
      return canceledIcon;
  }
}

function getStatusLabel(status: StatusCategory): string {
  switch (status) {
    case "pipeline":
      return "In Pipeline";
    case "done":
      return "Done";
    case "canceled":
      return "Canceled";
  }
}

export default function UnifiedMap({
  records = [],
  clusters = [],
  isCluster = false,
}: UnifiedMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<(L.Marker | L.CircleMarker)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateFilterParams } = useFilters();

  // Debounced function to update bounding box and zoom filters
  const debouncedUpdateBounds = useDebounceCallback((map: L.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    updateFilterParams({
      north: bounds.getNorth().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      west: bounds.getWest().toString(),
      zoom: zoom.toString(),
    });
  }, 500);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map centered on Seattle
    const map = L.map(containerRef.current, {
      center: [47.6062, -122.3321],
      zoom: 11,
      zoomControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Set up event listeners for zoom and pan
    map.on("moveend", () => debouncedUpdateBounds(map));
    map.on("zoomend", () => debouncedUpdateBounds(map));

    // Initial bounds update
    debouncedUpdateBounds(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [debouncedUpdateBounds]);

  // Render clusters or individual markers
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (isCluster && clusters.length > 0) {
      // Render neighborhood clusters as circles
      clusters.forEach((cluster) => {
        if (!cluster.neighborhood) return;

        const lat = cluster.centerLat;
        const lng = cluster.centerLng;

        if (isNaN(lat) || isNaN(lng)) return;

        // Calculate dominant status for color
        const maxCount = Math.max(
          cluster.pipelineCount,
          cluster.doneCount,
          cluster.canceledCount
        );
        let color = "#3b82f6"; // blue for pipeline
        if (cluster.doneCount === maxCount) color = "#22c55e"; // green for done
        else if (cluster.canceledCount === maxCount) color = "#9ca3af"; // gray for canceled

        // Size based on count (min 20, max 60)
        const radius = Math.min(Math.max(Math.sqrt(cluster.count) * 5, 20), 60);

        const circle = L.circleMarker([lat, lng], {
          radius,
          fillColor: color,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.6,
        }).addTo(map);

        // Add permanent label with neighborhood name and count
        const divIcon = L.divIcon({
          className: 'cluster-label',
          html: `
            <div style="
              background: rgba(255, 255, 255, 0.95);
              padding: 4px 8px;
              border-radius: 4px;
              border: 1px solid #ddd;
              font-size: 11px;
              font-weight: 600;
              text-align: center;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <div style="color: #1f2937;">${cluster.neighborhood}</div>
              <div style="color: #6b7280; font-size: 10px;">${cluster.count.toLocaleString()} permits</div>
            </div>
          `,
          iconSize: [100, 40],
          iconAnchor: [50, 20],
        });

        const label = L.marker([lat, lng], {
          icon: divIcon,
          interactive: false,
        }).addTo(map);

        // Add popup with detailed cluster info
        const popupContent = `
          <div style="font-size: 12px; min-width: 150px;">
            <strong>${cluster.neighborhood}</strong><br/>
            <strong>Total Permits:</strong> ${cluster.count.toLocaleString()}<br/>
            <div style="margin-top: 8px;">
              <div style="color: #3b82f6;">Pipeline: ${cluster.pipelineCount.toLocaleString()}</div>
              <div style="color: #22c55e;">Done: ${cluster.doneCount.toLocaleString()}</div>
              <div style="color: #9ca3af;">Canceled: ${cluster.canceledCount.toLocaleString()}</div>
            </div>
            <div style="margin-top: 8px; font-style: italic; color: #666;">
              Zoom in to see individual permits
            </div>
          </div>
        `;
        circle.bindPopup(popupContent);

        markersRef.current.push(circle);
        markersRef.current.push(label);
      });
    } else if (!isCluster && records.length > 0) {
      // Render individual markers
      const validRecords = records.filter((record) => {
        if (!record.latitude || !record.longitude) return false;
        const lat = parseFloat(record.latitude);
        const lng = parseFloat(record.longitude);
        return !isNaN(lat) && !isNaN(lng);
      });

      if (validRecords.length === 0) return;

      validRecords.forEach((record) => {
        const lat = parseFloat(record.latitude!);
        const lng = parseFloat(record.longitude!);

        const statusCategory = categorizeStatus(record.statusCurrent);
        const icon = getIconForStatus(statusCategory);
        const statusLabel = getStatusLabel(statusCategory);

        const marker = L.marker([lat, lng], {
          icon,
        }).addTo(map);

        // Format dates
        const appliedDate = record.appliedDate
          ? new Date(record.appliedDate).toLocaleDateString()
          : "Unknown";
        const completedDate = record.completedDate
          ? new Date(record.completedDate).toLocaleDateString()
          : "Not completed";

        // Add popup with permit info
        const popupContent = `
          <div style="font-size: 12px; min-width: 150px;">
            <strong>Permit ${record.permitNum}</strong><br/>
            <strong>Address:</strong> ${record.originalAddress1 || "Unknown"}<br/>
            <strong>Applied:</strong> ${appliedDate}<br/>
            <strong>Completed:</strong> ${completedDate}<br/>
            <strong>Status:</strong> ${statusLabel}${
          record.statusCurrent ? ` (${record.statusCurrent})` : ""
        }<br/>
            ${
              record.housingUnitsAdded !== null
                ? `<strong>Units Added:</strong> ${record.housingUnitsAdded}<br/>`
                : ""
            }
            ${
              record.link
                ? `<a href="${record.link}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">View on Seattle.gov →</a>`
                : ""
            }
          </div>
        `;
        marker.bindPopup(popupContent);

        markersRef.current.push(marker);
      });
    }
  }, [records, clusters, isCluster]);

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-255">
      <div className="p-4 border-b">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>{getStatusLabel("pipeline")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>{getStatusLabel("done")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>{getStatusLabel("canceled")}</span>
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-b-lg border-t border-gray-300 flex-1"
        style={{ zIndex: 0 }}
      />
    </div>
  );
}
