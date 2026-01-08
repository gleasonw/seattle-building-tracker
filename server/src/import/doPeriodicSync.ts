import { periodicSync } from "@/server/src/import/import";

async function doPeriodicSync() {
  try {
    await periodicSync();
  } catch (err) {
    console.error("Periodic sync failed:", err);
    process.exit(1);
  }
}

doPeriodicSync();
