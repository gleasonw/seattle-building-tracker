"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationMapProps {
  lat?: number;
  lng?: number;
  radius?: number; // in miles
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

export default function LocationMap({
  lat,
  lng,
  radius = 0.5,
  onLocationSelect,
}: LocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map centered on Seattle
    const map = L.map(containerRef.current, {
      center: [lat || 47.6062, lng || -122.3321],
      zoom: lat && lng ? 13 : 11,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Handle map clicks
    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;

      // Reverse geocode to get address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
        );
        const data = await response.json();
        const address =
          data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        onLocationSelect(lat, lng, address);
      } catch (error) {
        // Fallback to coordinates if geocoding fails
        onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker and circle when location/radius changes
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove existing marker and circle
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    // Add new marker and circle if we have a location
    if (lat && lng) {
      const marker = L.marker([lat, lng], {
        draggable: true,
      }).addTo(map);

      // Handle marker drag
      marker.on("dragend", async () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng();

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&addressdetails=1`
          );
          const data = await response.json();
          const address =
            data.display_name || `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;

          onLocationSelect(newLat, newLng, address);
        } catch (error) {
          onLocationSelect(
            newLat,
            newLng,
            `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`
          );
        }
      });

      markerRef.current = marker;

      // Add circle showing radius (convert miles to meters)
      const radiusInMeters = radius * 1609.34;
      const circle = L.circle([lat, lng], {
        radius: radiusInMeters,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);

      circleRef.current = circle;

      // Pan to location
      map.setView([lat, lng], 13);
    }
  }, [lat, lng, radius, onLocationSelect]);

  return (
    <div
      ref={containerRef}
      className="w-full h-64 rounded-lg border border-gray-300"
      style={{ zIndex: 0 }}
    />
  );
}
