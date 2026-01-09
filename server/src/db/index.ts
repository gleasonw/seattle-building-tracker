import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import "dotenv/config";

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not defined. Please create a .env.local file with your database connection string."
  );
}

// Configure PostgreSQL connection
// Use max: 10 for development, adjust to 20-30 for production
const connectionString = process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === "production";

const client = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 20 : 10,
  idle_timeout: 600, // 10 minutes
  connect_timeout: 30, // 30 seconds
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema, logger: !isProd });

// Export schema for convenience
export { schema };
