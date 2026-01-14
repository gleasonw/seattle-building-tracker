import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { buildingPermits } from "../db/schema.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GeoJSONFeature {
  type: "Feature";
  properties: {
    L_HOOD: string;
    S_HOOD: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSON {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

/**
 * Assigns neighborhoods to building permits using PostGIS point-in-polygon queries.
 * Reads the GeoJSON neighborhood data and updates permits based on their lat/lng.
 */
export async function assignNeighborhoods() {
  console.log("Starting neighborhood assignment...");

  // Load the GeoJSON file
  const geojsonPath = path.resolve(
    __dirname,
    "../../../Neighborhood_Map_Atlas_Neighborhoods.geojson"
  );
  console.log(`Loading GeoJSON from: ${geojsonPath}`);

  const geojsonContent = await readFile(geojsonPath, "utf-8");
  const geojson: GeoJSON = JSON.parse(geojsonContent);

  console.log(`Loaded ${geojson.features.length} neighborhoods`);

  // Process each neighborhood
  let totalUpdated = 0;

  for (const feature of geojson.features) {
    const neighborhood = feature.properties.L_HOOD;

    if (!neighborhood) {
      console.log("Skipping feature with no L_HOOD property");
      continue;
    }

    // Convert GeoJSON geometry to PostGIS format
    const geojsonStr = JSON.stringify(feature.geometry);

    try {
      // Update permits that fall within this neighborhood polygon
      // Using ST_Contains with the polygon and point constructed from lat/lng
      const result = await db.execute(sql`
        UPDATE building_permits
        SET neighborhood = ${neighborhood}
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND ST_Contains(
            ST_GeomFromGeoJSON(${geojsonStr}),
            ST_SetSRID(ST_MakePoint(CAST(longitude AS DOUBLE PRECISION), CAST(latitude AS DOUBLE PRECISION)), 4326)
          )
          AND neighborhood IS NULL
      `);

      const rowCount = (result as any).rowCount || 0;
      if (rowCount > 0) {
        console.log(`Assigned ${rowCount} permits to ${neighborhood}`);
        totalUpdated += rowCount;
      }
    } catch (error) {
      console.error(`Error processing neighborhood ${neighborhood}:`, error);
    }
  }

  console.log(`\nNeighborhood assignment complete!`);
  console.log(`Total permits assigned: ${totalUpdated}`);

  // Report on permits without neighborhoods
  const unassignedResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM building_permits
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND neighborhood IS NULL
  `);

  const unassignedCount = (unassignedResult.rows[0] as any)?.count || 0;
  console.log(`Permits without neighborhood assignment: ${unassignedCount}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  assignNeighborhoods()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to assign neighborhoods:", error);
      process.exit(1);
    });
}
