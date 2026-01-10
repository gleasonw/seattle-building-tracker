import { readFileSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import type { Feature, FeatureCollection, Polygon } from "geojson";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface NeighborhoodProperties {
  OBJECTID: number;
  L_HOOD: string;
  S_HOOD: string;
  S_HOOD_ALT_NAMES?: string | null;
  Shape__Area: number;
  Shape__Length: number;
}

type NeighborhoodFeature = Feature<Polygon, NeighborhoodProperties>;

interface PermitWithLocation {
  latitude?: string | null;
  longitude?: string | null;
}

interface NeighborhoodAssignment {
  neighborhoodId: number | null;
  neighborhood: string | null;
  largeNeighborhood: string | null;
}

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

let neighborhoodsCache: NeighborhoodFeature[] | null = null;

/**
 * Loads and caches the neighborhoods GeoJSON data.
 * Call this once at startup to avoid repeated file reads.
 */
export function loadNeighborhoods(): NeighborhoodFeature[] {
  if (neighborhoodsCache) {
    return neighborhoodsCache;
  }

  try {
    const geojsonPath = join(process.cwd(), "neighborhoods.geojson");
    const geojsonData = readFileSync(geojsonPath, "utf-8");
    const featureCollection: FeatureCollection<
      Polygon,
      NeighborhoodProperties
    > = JSON.parse(geojsonData);

    neighborhoodsCache = featureCollection.features as NeighborhoodFeature[];
    console.log(
      `✓ Loaded ${neighborhoodsCache.length} neighborhoods from GeoJSON`
    );

    return neighborhoodsCache;
  } catch (error) {
    console.error("Failed to load neighborhoods GeoJSON:", error);
    throw new Error("Could not load neighborhoods data");
  }
}

// ============================================================================
// POINT-IN-POLYGON LOOKUP
// ============================================================================

/**
 * Finds the neighborhood that contains the given latitude/longitude point.
 * Returns null if the point is outside all neighborhood boundaries.
 *
 * @param lat - Latitude in decimal degrees
 * @param lng - Longitude in decimal degrees
 * @returns Neighborhood assignment or null
 */
export function findNeighborhoodForPoint(
  lat: number,
  lng: number
): NeighborhoodAssignment | null {
  const neighborhoods = loadNeighborhoods();
  const targetPoint = point([lng, lat]); // GeoJSON uses [lng, lat] order

  for (const neighborhood of neighborhoods) {
    try {
      // Validate polygon geometry before creating turf polygon
      const coords = neighborhood.geometry.coordinates;

      // Check if it's a valid polygon (at least one ring with 4+ points)
      if (!coords || coords.length === 0 || coords[0].length < 4) {
        // Skip invalid geometries silently
        continue;
      }

      const poly = polygon(coords);

      if (booleanPointInPolygon(targetPoint, poly)) {
        return {
          neighborhoodId: neighborhood.properties.OBJECTID,
          neighborhood: neighborhood.properties.S_HOOD,
          largeNeighborhood: neighborhood.properties.L_HOOD,
        };
      }
    } catch {
      // Skip neighborhoods with malformed geometry without logging (too noisy)
      continue;
    }
  }

  // Point is outside all neighborhood boundaries
  return null;
}

// ============================================================================
// BATCH ASSIGNMENT
// ============================================================================

/**
 * Assigns neighborhood data to an array of permits with lat/lng coordinates.
 * Modifies the permits in-place by adding neighborhood fields.
 *
 * @param permits - Array of permits with latitude and longitude fields
 * @returns The same permits array with neighborhood data added
 */
export function assignNeighborhoods<T extends PermitWithLocation>(
  permits: T[]
): (T & {
  neighborhoodId: number | null;
  neighborhood: string | null;
  largeNeighborhood: string | null;
})[] {
  let successCount = 0;
  let outsideBoundariesCount = 0;
  let missingCoordsCount = 0;

  const results = permits.map((permit) => {
    const extended = permit as T & {
      neighborhoodId: number | null;
      neighborhood: string | null;
      largeNeighborhood: string | null;
    };

    // Check if coordinates exist and are valid
    if (!permit.latitude || !permit.longitude) {
      missingCoordsCount++;
      extended.neighborhoodId = null;
      extended.neighborhood = null;
      extended.largeNeighborhood = null;
      return extended;
    }

    const lat = parseFloat(permit.latitude);
    const lng = parseFloat(permit.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      missingCoordsCount++;
      extended.neighborhoodId = null;
      extended.neighborhood = null;
      extended.largeNeighborhood = null;
      return extended;
    }

    const assignment = findNeighborhoodForPoint(lat, lng);

    if (assignment) {
      successCount++;
      extended.neighborhoodId = assignment.neighborhoodId;
      extended.neighborhood = assignment.neighborhood;
      extended.largeNeighborhood = assignment.largeNeighborhood;
    } else {
      outsideBoundariesCount++;
      extended.neighborhoodId = null;
      extended.neighborhood = null;
      extended.largeNeighborhood = null;
    }

    return extended;
  });

  if (permits.length > 0) {
    console.log(
      `Neighborhood assignment: ${successCount} matched, ${outsideBoundariesCount} outside boundaries, ${missingCoordsCount} missing coordinates (total: ${permits.length})`
    );
  }

  return results;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Pre-loads neighborhoods at startup to avoid lazy loading during requests.
 * Call this in your server initialization code.
 */
export function initializeNeighborhoods(): void {
  loadNeighborhoods();
  console.log("✓ Neighborhoods initialized");
}
