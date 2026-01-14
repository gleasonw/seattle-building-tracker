import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { buildingPermits } from "../db/schema.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Point-in-polygon check without PostGIS
function isPointInPolygon(
  point: [number, number],
  polygon: number[][][]
): boolean {
  // Check first ring (outer boundary)
  const ring = polygon[0];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function isPointInMultiPolygon(
  point: [number, number],
  multiPolygon: number[][][][]
): boolean {
  for (const polygon of multiPolygon) {
    if (isPointInPolygon(point, polygon)) return true;
  }
  return false;
}

async function assignNeighborhoods() {
  console.log("Starting neighborhood assignment...");

  // Load GeoJSON file
  const geoJsonPath = path.join(
    __dirname,
    "../../../Neighborhood_Map_Atlas_Neighborhoods.geojson"
  );
  const geoJsonContent = await readFile(geoJsonPath, "utf-8");
  const geoJson = JSON.parse(geoJsonContent);

  console.log(`Loaded ${geoJson.features.length} neighborhoods`);

  // Get all permits with coordinates but no neighborhood
  const permits = await db
    .select({
      applicationPermitNumber: buildingPermits.applicationPermitNumber,
      latitude: buildingPermits.latitude,
      longitude: buildingPermits.longitude,
    })
    .from(buildingPermits)
    .where(
      sql`${buildingPermits.latitude} IS NOT NULL
          AND ${buildingPermits.longitude} IS NOT NULL
          AND ${buildingPermits.neighborhood} IS NULL`
    )
    .execute();

  console.log(`Found ${permits.length} permits to assign`);

  let assignedCount = 0;
  const batchSize = 100;

  // Process in batches
  for (let i = 0; i < permits.length; i += batchSize) {
    const batch = permits.slice(i, i + batchSize);

    for (const permit of batch) {
      const lat = parseFloat(permit.latitude!);
      const lng = parseFloat(permit.longitude!);
      const point: [number, number] = [lng, lat];

      // Find matching neighborhood
      for (const feature of geoJson.features) {
        const lHood = feature.properties.L_HOOD;
        if (!lHood) continue;

        const geometry = feature.geometry;
        let matches = false;

        if (geometry.type === "Polygon") {
          matches = isPointInPolygon(point, geometry.coordinates);
        } else if (geometry.type === "MultiPolygon") {
          matches = isPointInMultiPolygon(point, geometry.coordinates);
        }

        if (matches) {
          await db
            .update(buildingPermits)
            .set({ neighborhood: lHood })
            .where(
              sql`${buildingPermits.applicationPermitNumber} = ${permit.applicationPermitNumber}`
            )
            .execute();

          assignedCount++;
          break;
        }
      }
    }

    console.log(
      `Processed ${Math.min(i + batchSize, permits.length)} / ${
        permits.length
      } permits`
    );
  }

  console.log(`\nNeighborhood assignment complete!`);
  console.log(`Total permits assigned: ${assignedCount}`);

  // Check how many remain unassigned
  const unassignedResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM building_permits
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND neighborhood IS NULL
  `);

  const unassignedCount = (unassignedResult.rows[0] as any)?.count || 0;
  console.log(`Permits still unassigned: ${unassignedCount}`);
}

assignNeighborhoods()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to assign neighborhoods:", error);
    process.exit(1);
  });
