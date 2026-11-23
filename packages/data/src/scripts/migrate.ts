import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { db, sql } from "../db/client";
import { ensureReferenceData } from "../reference/load";

await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
console.log("Migrations applied.");
// Boundaries and derived tables that ship with the code (reference/load.ts).
const done = await ensureReferenceData(sql);
console.log(done.length ? `Reference data: ${done.join("; ")}.` : "Reference data up to date.");
await sql.end();
