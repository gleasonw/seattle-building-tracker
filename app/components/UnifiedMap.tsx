"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { categorizeStatus, StatusCategory } from "@/server/src/query";

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

interface UnifiedMapProps {
  records: Record[];
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

export default function UnifiedMap({ records }: UnifiedMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add markers for records
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for all records with valid coordinates
    const validRecords = records.filter((record) => {
      if (!record.latitude || !record.longitude) return false;
      const lat = parseFloat(record.latitude);
      const lng = parseFloat(record.longitude);
      return !isNaN(lat) && !isNaN(lng);
    });

    if (validRecords.length === 0) return;

    // Calculate bounds to fit all markers
    const bounds = L.latLngBounds(
      validRecords.map((record) => [
        parseFloat(record.latitude!),
        parseFloat(record.longitude!),
      ])
    );

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

    // Fit map to show all markers with some padding
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [records]);

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-full">
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
