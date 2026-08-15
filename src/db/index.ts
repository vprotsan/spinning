import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add your Supabase Postgres connection string to .env.local (see .env.example)."
  );
}

// Reuse the client across hot reloads / lambda invocations.
const client =
  global.__dbClient ??
  postgres(connectionString, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") {
  global.__dbClient = client;
}

export const db = drizzle(client, { schema });
