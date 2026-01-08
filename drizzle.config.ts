// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/src/db/schema.ts",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
