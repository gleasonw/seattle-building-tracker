import { db } from "../db";
import { buildingPermits, syncMetadata } from "../db/schema";
import { sql, eq } from "drizzle-orm";
import pLimit from "p-limit";
import dotenv from "dotenv";
import { assignNeighborhoods } from "../db/neighborhoods";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Seattle API Response Structure
 * Based on documented endpoint: https://data.seattle.gov/api/v3/views/76t5-zqzr/query.json
 */
interface SeattlePermitRecord {
  ":id"?: string;
  ":created_at"?: string;
  ":updated_at"?: string;
  permitnum: string;
  permitclass?: string;
  permitclassmapped?: string;
  permittypemapped?: string;
  permittypedesc?: string;
  description?: string;
  housingunits?: string;
  housingunitsremoved?: string;
  housingunitsadded?: string;
  estprojectcost?: string;
  applieddate?: string;
  issueddate?: string;
  expiresdate?: string;
  completeddate?: string;
  initialreviewcompletedate?: string;
  planreviewcompletedate?: string;
  readytoissuedate?: string;
  statuscurrent?: string;
  relatedmup?: string;
  parentpermitnum?: string;
  originaladdress1?: string;
  originalcity?: string;
  originalstate?: string;
  originalzip?: string;
  latitude?: string;
  longitude?: string;
  location1?: unknown;
  zoning?: string;
  contractorcompanyname?: string;
  link?: { url?: string } | string;
  totaldaysplanreview?: string;
  daysinitialplanreview?: string;
  daysplanreviewcity?: string;
  daysoutcorrections?: string;
  numberreviewcycles?: string;
  daysissuepermitcity?: string;
  dwellingunittype?: string;
  housingcategory?: string;
  standardplan?: string;
  dependentbuilding?: string;
}

/**
 * Configuration for import operations
 */
interface ImportConfig {
  apiEndpoint: string;
  appToken: string;
  pageSize: number;
  concurrencyLimit: number;
  retryAttempts: number;
  retryDelayMs: number;
}

/**
 * Date range for chunked imports
 */
interface DateChunk {
  startDate: Date;
  endDate: Date;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Progress tracking for imports
 */
interface ImportProgress {
  totalRecords: number;
  processedRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  failedRecords: number;
  currentChunk?: DateChunk;
  startTime: Date;
}

/**
 * Result of an import operation
 */
export interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  duration: number;
  errors: Array<{ permitNum: string; error: string }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================
dotenv.config({ path: ".env.local" });

const appToken = process.env.SEATTLE_PERMITS_APP_TOKEN;
if (!appToken) {
  throw new Error("SEATTLE_PERMITS_APP_TOKEN environment variable is not set.");
}

const DEFAULT_CONFIG: ImportConfig = {
  apiEndpoint: "https://data.seattle.gov/resource/76t5-zqzr.json",
  appToken,
  pageSize: 1000,
  concurrencyLimit: 5,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

const SYNC_METADATA_ID = "building_permits_sync";
const DATE_CHUNK_SIZE_MONTHS = 6;
const MIN_SYNC_INTERVAL_MS = 3600000; // 1 hour

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Performs a bulk historical import of all building permits.
 * Uses date-based chunking and concurrent API requests for efficiency.
 */
export async function bulkImport(
  startDate: Date = new Date("2010-01-01"),
  endDate: Date = new Date(),
  config: Partial<ImportConfig> = {}
): Promise<ImportResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = new Date();

  console.log("=".repeat(80));
  console.log("BULK IMPORT STARTED");
  console.log(
    `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
  );
  console.log("=".repeat(80));

  const progress: ImportProgress = {
    totalRecords: 0,
    processedRecords: 0,
    insertedRecords: 0,
    updatedRecords: 0,
    failedRecords: 0,
    startTime,
  };

  await updateSyncMetadata({
    id: SYNC_METADATA_ID,
    lastSyncStartedAt: startTime.toISOString(),
    lastSyncStatus: "in_progress",
  });

  try {
    const chunks = createDateChunks(startDate, endDate);
    console.log(
      `Created ${chunks.length} date chunks (${DATE_CHUNK_SIZE_MONTHS} months each)`
    );

    for (const chunk of chunks) {
      progress.currentChunk = chunk;
      console.log(
        `\nProcessing chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}: ` +
          `${chunk.startDate.toISOString().split("T")[0]} to ${
            chunk.endDate.toISOString().split("T")[0]
          }`
      );

      try {
        const records = await fetchChunkData(chunk, fullConfig);
        console.log(`  Fetched ${records.length} records`);

        progress.totalRecords += records.length;

        await upsertPermits(records, progress);
      } catch (error) {
        console.error(`  Failed to process chunk ${chunk.chunkIndex}:`, error);
        progress.failedRecords += 1;
      }
    }

    const duration = Date.now() - startTime.getTime();
    const result: ImportResult = {
      success: true,
      recordsProcessed: progress.processedRecords,
      recordsInserted: progress.insertedRecords,
      recordsUpdated: progress.updatedRecords,
      recordsFailed: progress.failedRecords,
      duration,
      errors: [],
    };

    await updateSyncMetadata({
      id: SYNC_METADATA_ID,
      lastSyncCompletedAt: new Date().toISOString(),
      lastSyncStatus: "success",
      totalRecordsProcessed: progress.processedRecords,
      recordsInserted: progress.insertedRecords,
      recordsUpdated: progress.updatedRecords,
      recordsFailed: progress.failedRecords,
    });

    console.log("\n" + "=".repeat(80));
    console.log("BULK IMPORT COMPLETED");
    console.log(`Duration: ${(duration / 1000 / 60).toFixed(2)} minutes`);
    console.log(`Processed: ${result.recordsProcessed}`);
    console.log(`Inserted: ${result.recordsInserted}`);
    console.log(`Updated: ${result.recordsUpdated}`);
    console.log(`Failed: ${result.recordsFailed}`);
    console.log("=".repeat(80));

    return result;
  } catch (error) {
    const duration = Date.now() - startTime.getTime();
    console.error("BULK IMPORT FAILED:", error);

    await updateSyncMetadata({
      id: SYNC_METADATA_ID,
      lastSyncStatus: "failed",
      lastSyncError: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      recordsProcessed: progress.processedRecords,
      recordsInserted: progress.insertedRecords,
      recordsUpdated: progress.updatedRecords,
      recordsFailed: progress.failedRecords,
      duration,
      errors: [{ permitNum: "N/A", error: String(error) }],
    };
  }
}

/**
 * Performs an incremental sync of permits updated since last sync.
 * Uses stored last sync timestamp to fetch only changed records.
 */
export async function periodicSync(
  config: Partial<ImportConfig> = {}
): Promise<ImportResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = new Date();

  console.log("=".repeat(80));
  console.log("PERIODIC SYNC STARTED");
  console.log("=".repeat(80));

  try {
    const lastSync = await db
      .select()
      .from(syncMetadata)
      .where(eq(syncMetadata.id, SYNC_METADATA_ID))
      .limit(1);

    const lastSyncTime = lastSync[0]?.lastSyncCompletedAt
      ? new Date(lastSync[0].lastSyncCompletedAt + "Z") // Force UTC interpretation
      : new Date("2000-01-01");

    console.log({ lastSync });

    const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
    if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
      console.log(
        `Last sync was ${(timeSinceLastSync / 1000 / 60).toFixed(
          2
        )} minutes ago.`
      );
      console.log(
        `Minimum interval is ${
          MIN_SYNC_INTERVAL_MS / 1000 / 60
        } minutes. Skipping.`
      );
      return {
        success: true,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        duration: 0,
        errors: [],
      };
    }

    console.log(`Syncing permits updated since: ${lastSyncTime.toISOString()}`);

    const progress: ImportProgress = {
      totalRecords: 0,
      processedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      failedRecords: 0,
      startTime,
    };

    await updateSyncMetadata({
      id: SYNC_METADATA_ID,
      lastSyncStartedAt: startTime.toISOString(),
      lastSyncStatus: "in_progress",
    });

    const records = await fetchNewCompletedAndIssuedRecords(
      lastSyncTime,
      fullConfig
    );
    console.log(`Fetched ${records.length} updated records`);

    progress.totalRecords = records.length;

    if (records.length > 0) {
      await upsertPermits(records, progress);
    }

    const duration = Date.now() - startTime.getTime();
    const result: ImportResult = {
      success: true,
      recordsProcessed: progress.processedRecords,
      recordsInserted: progress.insertedRecords,
      recordsUpdated: progress.updatedRecords,
      recordsFailed: progress.failedRecords,
      duration,
      errors: [],
    };

    await updateSyncMetadata({
      id: SYNC_METADATA_ID,
      lastSyncCompletedAt: new Date().toISOString(),
      lastSyncStatus: "success",
      totalRecordsProcessed: progress.processedRecords,
      recordsInserted: progress.insertedRecords,
      recordsUpdated: progress.updatedRecords,
      recordsFailed: progress.failedRecords,
    });

    console.log("\n" + "=".repeat(80));
    console.log("PERIODIC SYNC COMPLETED");
    console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`Processed: ${result.recordsProcessed}`);
    console.log(`Inserted: ${result.recordsInserted}`);
    console.log(`Updated: ${result.recordsUpdated}`);
    console.log(`Failed: ${result.recordsFailed}`);
    console.log("=".repeat(80));

    return result;
  } catch (error) {
    const duration = Date.now() - startTime.getTime();
    console.error("PERIODIC SYNC FAILED:", error);

    await updateSyncMetadata({
      id: SYNC_METADATA_ID,
      lastSyncStatus: "failed",
      lastSyncError: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      duration,
      errors: [{ permitNum: "N/A", error: String(error) }],
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS - Date Chunking
// ============================================================================

/**
 * Divides a date range into chunks of specified size.
 */
function createDateChunks(
  startDate: Date,
  endDate: Date,
  chunkSizeMonths: number = DATE_CHUNK_SIZE_MONTHS
): DateChunk[] {
  const chunks: DateChunk[] = [];
  let currentStart = new Date(startDate);
  let chunkIndex = 0;

  while (currentStart < endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setMonth(currentEnd.getMonth() + chunkSizeMonths);

    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }

    chunks.push({
      startDate: new Date(currentStart),
      endDate: new Date(currentEnd),
      chunkIndex,
      totalChunks: 0,
    });

    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    chunkIndex++;
  }

  chunks.forEach((chunk) => (chunk.totalChunks = chunks.length));

  return chunks;
}

// ============================================================================
// HELPER FUNCTIONS - API Fetching
// ============================================================================

/**
 * Fetches all pages for a given date chunk using controlled concurrency.
 */
async function fetchChunkData(
  chunk: DateChunk,
  config: ImportConfig
): Promise<SeattlePermitRecord[]> {
  const limit = pLimit(config.concurrencyLimit);
  const allRecords: SeattlePermitRecord[] = [];

  // Build URL for first page using Socrata SODA API
  const url = new URL(config.apiEndpoint);
  url.searchParams.set("$limit", config.pageSize.toString());
  url.searchParams.set("$offset", "0");
  if (config.appToken) {
    url.searchParams.set("$$app_token", config.appToken);
  }

  // Filter by date range AND permit type (exclude exemptions/exceptions)
  // Require applieddate (when permit application was submitted)
  const whereClause =
    `applieddate >= '${formatDateForAPI(chunk.startDate)}T00:00:00' AND ` +
    `applieddate <= '${formatDateForAPI(chunk.endDate)}T23:59:59' AND ` +
    `permittypemapped IN ('Building', 'Demolition', 'Land Use') AND ` +
    `applieddate IS NOT NULL`;
  url.searchParams.set("$where", whereClause);
  url.searchParams.set("$order", "applieddate ASC");

  const firstPageData = await fetchWithRetry(url.toString(), config);
  allRecords.push(...firstPageData);

  // If there's only one page worth of data, return early
  if (firstPageData.length < config.pageSize) {
    return allRecords;
  }

  // Fetch subsequent pages with offset until we get less than pageSize records
  const pagePromises = [];
  let offset = config.pageSize;

  // Fetch up to 100 pages concurrently (should be more than enough)
  for (let page = 1; page < 100; page++) {
    const currentOffset = offset;
    pagePromises.push(
      limit(async () => {
        const pageUrl = new URL(url.toString());
        pageUrl.searchParams.set("$offset", currentOffset.toString());
        const data = await fetchWithRetry(pageUrl.toString(), config);
        return { offset: currentOffset, data };
      })
    );
    offset += config.pageSize;
  }

  const results = await Promise.all(pagePromises);

  for (const result of results) {
    if (result.data.length === 0) break;
    allRecords.push(...result.data);
    if (result.data.length < config.pageSize) break;
  }

  return allRecords;
}

async function fetchNewCompletedAndIssuedRecords(
  since: Date,
  config: ImportConfig
): Promise<SeattlePermitRecord[]> {
  const limit = pLimit(config.concurrencyLimit);
  const allRecords: SeattlePermitRecord[] = [];

  const url = new URL(config.apiEndpoint);
  url.searchParams.set("$limit", config.pageSize.toString());
  url.searchParams.set("$offset", "0");
  if (config.appToken) {
    url.searchParams.set("$$app_token", config.appToken);
  }
  // the idea is to fetch any records that have been issued since our last sync or completed since our last sync.
  // of course, if an old record is updated, we won't catch it with this method, but still, we avoid
  // refetching all the data.
  const sinceFormatted = formatDateForAPI(since);
  url.searchParams.set(
    "$where",
    `permittypemapped IN ('Building', 'Demolition', 'Land Use') AND applieddate IS NOT NULL AND (issueddate >= '${sinceFormatted}T00:00:00' OR completeddate >= '${sinceFormatted}T00:00:00')`
  );
  url.searchParams.set("$order", ":updated_at ASC");

  const firstPageData = await fetchWithRetry(url.toString(), config);
  allRecords.push(...firstPageData);

  if (firstPageData.length < config.pageSize) {
    return allRecords;
  }

  // Fetch remaining pages with offset
  const pagePromises = [];
  let offset = config.pageSize;

  for (let page = 1; page < 100; page++) {
    const currentOffset = offset;
    pagePromises.push(
      limit(async () => {
        const pageUrl = new URL(url.toString());
        pageUrl.searchParams.set("$offset", currentOffset.toString());
        const data = await fetchWithRetry(pageUrl.toString(), config);
        return { offset: currentOffset, data };
      })
    );
    offset += config.pageSize;
  }

  const results = await Promise.all(pagePromises);

  for (const result of results) {
    if (result.data.length === 0) break;
    allRecords.push(...result.data);
    if (result.data.length < config.pageSize) break;
  }

  return allRecords;
}

/**
 * Generic fetch with retry logic.
 */
async function fetchWithRetry(
  url: string,
  config: ImportConfig,
  attempt: number = 1
): Promise<SeattlePermitRecord[]> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Seattle API returns array directly
    if (Array.isArray(data)) {
      return data;
    }

    // Or might be wrapped in a data property
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

    return [];
  } catch (error) {
    if (attempt < config.retryAttempts) {
      const delay = config.retryDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `Fetch failed, attempt ${attempt}/${config.retryAttempts}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
      return fetchWithRetry(url, config, attempt + 1);
    }
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS - Database Operations
// ============================================================================

/**
 * Performs database upsert using Drizzle ORM.
 * Batch processes records for efficiency.
 */
async function upsertPermits(
  records: SeattlePermitRecord[],
  progress: ImportProgress
): Promise<void> {
  const BATCH_SIZE = 100;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    try {
      await db.transaction(async (tx) => {
        // Map all records in the batch first
        const mappedRecords = batch.map((record) =>
          mapAPIRecordToSchema(record)
        );

        // Assign neighborhoods to all records in the batch
        assignNeighborhoods(mappedRecords);

        // Insert/update records with neighborhood data
        for (const mapped of mappedRecords) {
          await tx
            .insert(buildingPermits)
            .values(mapped)
            .onConflictDoUpdate({
              target: buildingPermits.permitNum,
              set: {
                ...mapped,
                localUpdatedAt: sql`now()`,
              },
            });
        }
      });

      progress.processedRecords += batch.length;
      progress.insertedRecords += batch.length; // Note: Can't easily distinguish insert vs update
      logProgress(progress);
    } catch (error) {
      console.error(`Failed to upsert batch starting at index ${i}:`, error);
      progress.failedRecords += batch.length;
    }
  }
}

/**
 * Maps a Seattle API permit record to our database schema.
 */
function mapAPIRecordToSchema(
  record: SeattlePermitRecord
): typeof buildingPermits.$inferInsert {
  return {
    permitNum: record.permitnum,
    relatedMup: record.relatedmup || null,
    parentPermitNum: record.parentpermitnum || null,
    permitClass: record.permitclass || null,
    permitClassMapped: record.permitclassmapped || null,
    permitTypeMapped: record.permittypemapped || null,
    permitTypeDesc: record.permittypedesc || null,
    description: record.description || null,
    housingUnits: parseInteger(record.housingunits),
    housingUnitsRemoved: parseInteger(record.housingunitsremoved),
    housingUnitsAdded: parseInteger(record.housingunitsadded),
    estProjectCost: parseDecimal(record.estprojectcost),
    appliedDate: parseDate(record.applieddate),
    issuedDate: parseDate(record.issueddate),
    expiresDate: parseDate(record.expiresdate),
    completedDate: parseDate(record.completeddate),
    initialReviewCompleteDate: parseDate(record.initialreviewcompletedate),
    planReviewCompleteDate: parseDate(record.planreviewcompletedate),
    readyToIssueDate: parseDate(record.readytoissuedate),
    statusCurrent: record.statuscurrent || null,
    originalAddress1: record.originaladdress1 || null,
    originalCity: record.originalcity || null,
    originalState: record.originalstate || null,
    originalZip: record.originalzip || null,
    latitude: parseDecimal(record.latitude),
    longitude: parseDecimal(record.longitude),
    location1: null, // Skip complex location object
    zoning: record.zoning || null,
    contractorCompanyName: record.contractorcompanyname || null,
    link: extractLinkUrl(record.link),
    remoteCreatedAt: record[":created_at"] || null,
    remoteUpdatedAt: record[":updated_at"] || null,
    totalDaysPlanReview: parseInteger(record.totaldaysplanreview),
    daysInitialPlanReview: parseInteger(record.daysinitialplanreview),
    daysPlanReviewCity: parseInteger(record.daysplanreviewcity),
    daysOutCorrections: parseInteger(record.daysoutcorrections),
    numberReviewCycles: parseInteger(record.numberreviewcycles),
    daysIssuePermitCity: parseInteger(record.daysissuepermitcity),
    dwellingUnitType: record.dwellingunittype || null,
    housingCategory: record.housingcategory || null,
    standardPlan: parseBoolean(record.standardplan),
    dependentBuilding: parseBoolean(record.dependentbuilding),
  };
}

/**
 * Updates sync metadata record.
 */
async function updateSyncMetadata(
  data: Partial<typeof syncMetadata.$inferInsert>
): Promise<void> {
  await db
    .insert(syncMetadata)
    .values({
      id: SYNC_METADATA_ID,
      ...data,
    } as typeof syncMetadata.$inferInsert)
    .onConflictDoUpdate({
      target: syncMetadata.id,
      set: data,
    });
}

// ============================================================================
// HELPER FUNCTIONS - Field Parsing
// ============================================================================

/**
 * Parses an ISO date string to YYYY-MM-DD format.
 */
function parseDate(dateString?: string): string | null {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Parses a numeric string to decimal.
 */
function parseDecimal(value?: string): string | null {
  if (!value) return null;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) return null;

  return parsed.toString();
}

/**
 * Parses a string to integer.
 */
function parseInteger(value?: string): number | null {
  if (!value) return null;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return null;

  return parsed;
}

/**
 * Parses a string/number to boolean.
 */
function parseBoolean(value?: string): boolean | null {
  if (!value) return null;

  if (value === "1" || value === "true" || value === "TRUE") return true;
  if (value === "0" || value === "false" || value === "FALSE") return false;

  return null;
}

/**
 * Extracts URL from link field (can be object or string).
 */
function extractLinkUrl(link?: { url?: string } | string): string | null {
  if (!link) return null;

  if (typeof link === "string") return link;
  if (typeof link === "object" && link.url) return link.url;

  return null;
}

// ============================================================================
// HELPER FUNCTIONS - Utilities
// ============================================================================

/**
 * Formats a date for Seattle API queries.
 */
function formatDateForAPI(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Logs import progress to console.
 */
function logProgress(progress: ImportProgress): void {
  const elapsed = Date.now() - progress.startTime.getTime();
  const rate = progress.processedRecords / (elapsed / 1000);

  if (progress.processedRecords % 100 === 0) {
    console.log(
      `  Progress: ${progress.processedRecords}/${progress.totalRecords} ` +
        `(${((progress.processedRecords / progress.totalRecords) * 100).toFixed(
          1
        )}%) ` +
        `| Rate: ${rate.toFixed(1)} records/sec ` +
        `| Inserted: ${progress.insertedRecords} ` +
        `| Updated: ${progress.updatedRecords} ` +
        `| Failed: ${progress.failedRecords}`
    );
  }
}
