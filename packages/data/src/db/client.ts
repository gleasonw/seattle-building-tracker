import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // Reused across hot reloads in development.
  var __sbtSql: ReturnType<typeof postgres> | undefined;
}

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

export const sql =
  globalThis.__sbtSql ??
  postgres(connectionString(), {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 600,
    connect_timeout: 30,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalThis.__sbtSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
