const SUPABASE_HOST = /supabase\.co|pooler\.supabase\.com/;

export function applyDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !SUPABASE_HOST.test(raw)) return raw ?? null;
  let next = raw;
  if (!/[?&]sslmode=/.test(next)) next += `${next.includes("?") ? "&" : "?"}sslmode=require`;
  const limit = process.env.VERCEL ? "1" : "5";
  if (!/[?&]connection_limit=/.test(next)) next += `&connection_limit=${limit}`;
  if (!/[?&]pool_timeout=/.test(next)) next += "&pool_timeout=20";
  if (/pooler\.supabase\.com:\d+/.test(next) && /:6543(\/|\?|$)/.test(next) && !/[?&]pgbouncer=/.test(next)) {
    next += "&pgbouncer=true";
  }
  process.env.DATABASE_URL = next;
  return next;
}

export function databaseFailureMessage(error: unknown) {
  const text = error instanceof Error ? error.message : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const unreachable = code === "ENETUNREACH" || code === "P1001" || /ENETUNREACH|Can't reach database server/i.test(text);
  const direct = /db\.[a-z0-9]+\.supabase\.co/i.test(process.env.DATABASE_URL ?? "");
  if (unreachable && direct) {
    return "The database is on an IPv6-only address, so this server cannot reach it. Set DATABASE_URL to the Supabase session pooler on port 5432.";
  }
  if (unreachable) return "The database cannot be reached from this server.";
  return "Database unavailable.";
}
