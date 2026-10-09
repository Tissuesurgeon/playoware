import { afterEach, describe, expect, it } from "vitest";
import { applyDatabaseUrl, databaseFailureMessage } from "@/lib/db/url";

const original = process.env.DATABASE_URL;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("database url", () => {
  it("keeps a local url unchanged", () => {
    process.env.DATABASE_URL = "postgresql://playoware:playoware@127.0.0.1:5434/playoware";
    expect(applyDatabaseUrl()).toBe(process.env.DATABASE_URL);
  });

  it("uses one connection on Vercel and marks the transaction pooler", () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = "postgresql://postgres.example:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
    const next = applyDatabaseUrl();
    expect(next).toContain("sslmode=require");
    expect(next).toContain("connection_limit=1");
    expect(next).toContain("pgbouncer=true");
  });

  it("explains an unreachable Supabase direct host", () => {
    process.env.DATABASE_URL = "postgresql://postgres:secret@db.example.supabase.co:5432/postgres?sslmode=require";
    const error = Object.assign(new Error("connect ENETUNREACH"), { code: "ENETUNREACH" });
    expect(databaseFailureMessage(error)).toContain("IPv6-only");
    expect(databaseFailureMessage(error)).not.toContain("secret");
  });
});
