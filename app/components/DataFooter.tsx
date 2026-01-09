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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2 text-right text-xs text-gray-600">
      <div className="mb-1 flex gap-1">
        Data from
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
        <div className="text-[10px] text-gray-500 whitespace-nowrap">
          Last synced:{" "}
          {new Date(syncMeta.lastSyncCompletedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}
