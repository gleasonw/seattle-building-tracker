/**
 * Nightly sync (DEV_REWRITE_SPEC §4.2): full snapshot of the portal → staging →
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
import { deriveGeography, rebuildProjects, removeMissing, upsertPermits, writeEvents, type Tx } from "./merge";

const INSERT_BATCH = 1_000;
const FETCH_ATTEMPTS = 2;

class SyncError extends Error {}

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

    const result = await sql.begin(async (transaction) => {
      const tx = transaction as unknown as Tx;
      const eventsWritten = await writeEvents(tx, runId);
      const { inserted, updated } = await upsertPermits(tx);
      const removed = await removeMissing(tx, runId);
      await deriveGeography(tx, startedAt);
      const projects = await rebuildProjects(tx);
      return { eventsWritten: eventsWritten + removed, inserted, updated, removed, projects };
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
        details: { duplicates, projects: result.projects },
      })
      .where(eq(syncRuns.id, runId));
    if (!process.argv.includes("--keep-staging")) await sql`TRUNCATE permits_staging`;
    console.log(`Sync run ${runId} succeeded`, result);
    await notifyWebApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(syncRuns)
      .set({ status: "failed", finishedAt: new Date().toISOString(), error: message })
      .where(eq(syncRuns.id, runId));
    console.error(`Sync run ${runId} failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

await main();
