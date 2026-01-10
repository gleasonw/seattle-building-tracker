import { db } from "../db";
import { buildingPermits } from "../db/schema";
import { sql } from "drizzle-orm";
import { assignNeighborhoods } from "../db/neighborhoods";

/**
 * Backfills neighborhood data for all existing building permits.
 * Processes permits in batches to avoid memory issues and provide progress updates.
 */
async function backfillNeighborhoods() {
  console.log("=".repeat(80));
  console.log("NEIGHBORHOOD BACKFILL STARTED");
  console.log("=".repeat(80));

  const startTime = Date.now();
  const BATCH_SIZE = 500;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let currentOffset = 0;

  try {
    // Get total count of permits with coordinates
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(buildingPermits)
      .where(
        sql`${buildingPermits.latitude} IS NOT NULL AND ${buildingPermits.longitude} IS NOT NULL`
      );

    const totalPermits = countResult[0]?.count || 0;
    console.log(
      `\nFound ${totalPermits.toLocaleString()} permits with coordinates to process\n`
    );

    if (totalPermits === 0) {
      console.log("No permits to process. Exiting.");
      return;
    }

    // Process in batches
    while (true) {
      console.log(
        `Processing batch ${
          Math.floor(currentOffset / BATCH_SIZE) + 1
        } (offset: ${currentOffset})...`
      );

      // Fetch batch of permits with coordinates
      const permits = await db
        .select({
          permitNum: buildingPermits.permitNum,
          latitude: buildingPermits.latitude,
          longitude: buildingPermits.longitude,
        })
        .from(buildingPermits)
        .where(
          sql`${buildingPermits.latitude} IS NOT NULL AND ${buildingPermits.longitude} IS NOT NULL`
        )
        .limit(BATCH_SIZE)
        .offset(currentOffset);

      if (permits.length === 0) {
        break;
      }

      // Assign neighborhoods to the batch
      const permitsWithNeighborhoods = assignNeighborhoods(permits);

      // Update each permit with neighborhood data
      for (const permit of permitsWithNeighborhoods) {
        try {
          await db
            .update(buildingPermits)
            .set({
              neighborhoodId: permit.neighborhoodId,
              neighborhood: permit.neighborhood,
              largeNeighborhood: permit.largeNeighborhood,
            })
            .where(sql`${buildingPermits.permitNum} = ${permit.permitNum}`);

          totalUpdated++;
        } catch (error) {
          console.error(`Failed to update permit ${permit.permitNum}:`, error);
        }
      }

      totalProcessed += permits.length;
      currentOffset += BATCH_SIZE;

      const percentComplete = ((totalProcessed / totalPermits) * 100).toFixed(
        1
      );
      console.log(
        `Progress: ${totalProcessed.toLocaleString()}/${totalPermits.toLocaleString()} (${percentComplete}%)\n`
      );

      // Stop if we've processed fewer records than the batch size (last batch)
      if (permits.length < BATCH_SIZE) {
        break;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("=".repeat(80));
    console.log("BACKFILL COMPLETED");
    console.log("=".repeat(80));
    console.log(`Total processed: ${totalProcessed.toLocaleString()}`);
    console.log(`Total updated: ${totalUpdated.toLocaleString()}`);
    console.log(`Duration: ${duration}s`);
    console.log("=".repeat(80));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  }
}

// Run the backfill
backfillNeighborhoods();
