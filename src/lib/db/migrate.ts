import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { applyDatabaseUrl } from "@/lib/db/url";

let pending: Promise<void> | null = null;

function pgConnectionString(url: string) {
  if (!/supabase\.co|pooler\.supabase\.com/.test(url) || /[?&]uselibpqcompat=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}uselibpqcompat=true`;
}

export function ensureMigrations() {
  pending ??= applyPending().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

async function applyPending() {
  applyDatabaseUrl();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const root = path.join(process.cwd(), "prisma/migrations");
  const names = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const client = new pg.Client({
    connectionString: pgConnectionString(connectionString),
    connectionTimeoutMillis: 8_000,
  });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(842615)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `);
    const applied = await client.query<{ migration_name: string }>(`SELECT migration_name FROM "_prisma_migrations"`);
    const done = new Set(applied.rows.map((row) => row.migration_name));
    for (const name of names) {
      if (done.has(name)) continue;
      const sql = readFileSync(path.join(root, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)`,
          [randomUUID(), checksum, name],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(842615)").catch(() => undefined);
    await client.end();
  }
}
