import { db } from "@/server/src/db";
import { syncMetadata } from "@/server/src/db/schema";
import { eq } from "drizzle-orm";

const SYNC_METADATA_ID = "building_permits_sync";
const DATASET_URL =
  "https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr";

async function getSyncMetadata() {
  const result = await db
    .select()
    .from(syncMetadata)
    .where(eq(syncMetadata.id, SYNC_METADATA_ID))
    .limit(1);

  return result[0] || null;
}

export default async function DataFooter() {
  const syncMeta = await getSyncMetadata();

  return (
    <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
      <div className="mb-2">
        Data from{" "}
        <a
          href={DATASET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Seattle Open Data Portal
        </a>
      </div>
      {syncMeta?.lastSyncCompletedAt && (
        <div className="text-xs text-gray-500">
          Last synced:{" "}
          {new Date(syncMeta.lastSyncCompletedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      )}
    </div>
  );
}
