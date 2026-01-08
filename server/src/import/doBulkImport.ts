import { bulkImport } from "@/server/src/import/import";

async function doBulkImport() {
  try {
    await bulkImport();
    process.exit(0);
  } catch (err) {
    console.error("Bulk import failed:", err);
    process.exit(1);
  }
}

doBulkImport();
