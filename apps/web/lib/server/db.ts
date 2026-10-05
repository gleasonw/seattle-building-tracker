import "server-only";
import type { SQL } from "drizzle-orm";
import { db } from "@sbt/data/db/client";

/** Run a raw SQL query and return typed rows. */
export async function query<T extends Record<string, unknown>>(statement: SQL): Promise<T[]> {
  return (await db.execute(statement)) as unknown as T[];
}
