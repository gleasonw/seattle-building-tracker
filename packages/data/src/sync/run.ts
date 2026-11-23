/**
 * Nightly sync: full snapshot of the portal → staging →
 * reconcile → merge in one transaction. Any failure fails the whole run, and the live
 * tables are only touched once the snapshot is complete and reconciled.
 *
 * Usage: pnpm --filter @sbt/data sync
 */
import "dotenv/config";
import { db, sql } from "../db/client";
import { permitsStaging, syncRuns } from "../db/schema";
import { normalizeRecord, type StagingRow } from "../domain/normalize";
import { UnknownStatusError } from "../domain/status";
import { eq } from "drizzle-orm";
import { countSource, fetchAllRecords } from "./portal";
import { deriveGeography, flagRestatedUnits, rebuildProjects, removeMissing, upsertPermits, writeEvents, type Tx } from "./merge";

const INSERT_BATCH = 1_000;
const FETCH_ATTEMPTS = 2;

class SyncError extends Error {}

/** Prefix on recorded errors that must not be shown publicly (see web getFreshness). */
export const INTERNAL_ERROR_PREFIX = "internal: ";

async function stageSnapshot() {
  await sql`TRUNCATE permits_staging`;
  const unknownStatuses = new Map<string, number>();
  let staged = 0;
  let duplicates = 0;

  for await (const page of fetchAllRecords()) {
    const rows: StagingRow[] = [];
    for (const record of page) {
      try {
        rows.push(normalizeRecord(record));
      } catch (error) {
        if (!(error instanceof UnknownStatusError)) throw error;
        unknownStatuses.set(error.status, (unknownStatuses.get(error.status) ?? 0) + 1);
      }
    }
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const inserted = await db.insert(permitsStaging).values(batch).onConflictDoNothing().returning({
        permitNum: permitsStaging.permitNum,
      });
      staged += inserted.length;
      duplicates += batch.length - inserted.length;
    }
    process.stdout.write(`\r  staged ${staged.toLocaleString()} rows`);
  }
  process.stdout.write("\n");

  if (unknownStatuses.size > 0) {
    const list = [...unknownStatuses].map(([s, n]) => `"${s}" (${n})`).join(", ");
    throw new SyncError(`Unknown status values: ${list}. Add them to domain/status.ts.`);
  }
  return { staged, duplicates };
}

/** Fetch until the staged snapshot matches the portal's own count. */
async function fetchReconciled() {
  for (let attempt = 1; ; attempt++) {
    const sourceCount = await countSource();
    const { staged, duplicates } = await stageSnapshot();
    if (staged + duplicates === sourceCount) return { sourceCount, staged, duplicates };
    const message = `Reconciliation failed: portal reports ${sourceCount} rows, fetched ${staged + duplicates}.`;
    if (attempt >= FETCH_ATTEMPTS) throw new SyncError(message);
    console.warn(`${message} The portal may be mid-reload; retrying.`);
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

/**
 * Fields the sync tracks changes in. If the snapshot suddenly lacks one of them on a large
 * share of the permits that had it, the portal is serving a broken export: in late October
 * 2026 it dropped `expiresdate` from ~138k rows for three days, then restored the same values.
 * Merging that would rewrite every permit and log the gap as changes (SPEC open question 7).
 */
const TRACKED_FIELDS = ["status_current", "applied_date", "issued_date", "expires_date", "completed_date", "latitude"] as const;
/** Fail the run when more than this share of a field's values (and at least FIELD_DROPOUT_MIN_ROWS) vanish at once. */
const FIELD_DROPOUT_SHARE = 0.05;
const FIELD_DROPOUT_MIN_ROWS = 500;

/**
 * Fields allowed to drop out this run: `--allow-field-dropout` or SYNC_ALLOW_FIELD_DROPOUT=1/true
 * allows all; SYNC_ALLOW_FIELD_DROPOUT=expires_date,latitude allows just those (for an
 * unattended run after checking the change is real).
 */
function allowedDropouts(): Set<string> | "all" {
  if (process.argv.includes("--allow-field-dropout")) return "all";
  const env = process.env.SYNC_ALLOW_FIELD_DROPOUT?.trim().toLowerCase();
  if (!env) return new Set();
  if (env === "1" || env === "true") return "all";
  return new Set(env.split(",").map((f) => f.trim()).filter(Boolean));
}

async function checkFieldDropouts() {
  const allowed = allowedDropouts();
  if (allowed === "all") return;
  const counts = TRACKED_FIELDS.map(
    (f) =>
      `count(*) FILTER (WHERE p.${f} IS NOT NULL)::int AS "${f}_live", count(*) FILTER (WHERE p.${f} IS NOT NULL AND s.${f} IS NULL)::int AS "${f}_cleared"`,
  ).join(", ");
  const [row] = await sql.unsafe<Record<string, number>[]>(`
    SELECT ${counts} FROM permits p JOIN permits_staging s USING (permit_num) WHERE p.removed_at IS NULL
  `);
  const broken = TRACKED_FIELDS.filter((f) => !allowed.has(f)).filter((f) => {
    const cleared = row![`${f}_cleared`]!;
    return cleared >= FIELD_DROPOUT_MIN_ROWS && cleared > row![`${f}_live`]! * FIELD_DROPOUT_SHARE;
  });
  if (broken.length) {
    const detail = broken.map((f) => `${f}: ${row![`${f}_cleared`]} of ${row![`${f}_live`]} values missing`).join("; ");
    throw new SyncError(
      `The portal snapshot is missing values it had before (${detail}). Likely a broken export; ` +
        `keeping the previous data. If the change is real, set SYNC_ALLOW_FIELD_DROPOUT=${broken.join(",")} ` +
        "(or run with --allow-field-dropout).",
    );
  }
}

async function reuseStaging() {
  const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM permits_staging`;
  if (!row?.n) throw new SyncError("--reuse-staging: permits_staging is empty.");
  return { sourceCount: row.n, staged: row.n, duplicates: 0 };
}

async function notifyWebApp() {
  const url = process.env.WEB_REVALIDATE_URL;
  if (!url) return;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.REVALIDATE_SECRET ?? ""}` },
  });
  if (!res.ok) console.warn(`Revalidation request failed: ${res.status}`);
}

async function main() {
  const [run] = await db.insert(syncRuns).values({ status: "running" }).returning();
  const runId = run!.id;
  const startedAt = run!.startedAt;
  console.log(`Sync run ${runId} started at ${startedAt}`);

  try {
    // --reuse-staging: development aid to re-run the merge against the last fetched snapshot.
    const { sourceCount, staged, duplicates } = process.argv.includes("--reuse-staging")
      ? await reuseStaging()
      : await fetchReconciled();
    console.log(`  reconciled: ${staged} staged, ${duplicates} duplicate permit numbers skipped`);
    await checkFieldDropouts();

    const result = await sql.begin(async (transaction) => {
      const tx = transaction as unknown as Tx;
      // Don't merge while reference/load.ts is reassigning places (same lock).
      await tx`SELECT pg_advisory_xact_lock(hashtext('sbt_reference_data'))`;
      const eventsWritten = await writeEvents(tx, runId);
      const { inserted, updated } = await upsertPermits(tx);
      const removed = await removeMissing(tx, runId);
      await deriveGeography(tx, startedAt);
      const restated = await flagRestatedUnits(tx);
      const projects = await rebuildProjects(tx);
      return { eventsWritten: eventsWritten + removed, inserted, updated, removed, projects, restated };
    });

    await db
      .update(syncRuns)
      .set({
        status: "success",
        finishedAt: new Date().toISOString(),
        sourceCount,
        stagedCount: staged,
        inserted: result.inserted,
        updated: result.updated,
        removed: result.removed,
        eventsWritten: result.eventsWritten,
        details: { duplicates, projects: result.projects, restated: result.restated },
      })
      .where(eq(syncRuns.id, runId));
    if (!process.argv.includes("--keep-staging")) await sql`TRUNCATE permits_staging`;
    console.log(`Sync run ${runId} succeeded`, result);
    await notifyWebApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Only SyncError messages are written for the public freshness notice; anything else
    // (database or network errors) may contain hosts or SQL, so it's marked internal.
    const recorded = error instanceof SyncError ? message : `${INTERNAL_ERROR_PREFIX}${message}`;
    await db
      .update(syncRuns)
      .set({ status: "failed", finishedAt: new Date().toISOString(), error: recorded })
      .where(eq(syncRuns.id, runId));
    console.error(`Sync run ${runId} failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

await main();
