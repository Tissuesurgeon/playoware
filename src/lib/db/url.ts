const SUPABASE_HOST = /supabase\.co|pooler\.supabase\.com/;

export function applyDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !SUPABASE_HOST.test(raw)) return raw ?? null;
  let next = raw;
  if (!/[?&]sslmode=/.test(next)) next += `${next.includes("?") ? "&" : "?"}sslmode=require`;
  if (!/[?&]connection_limit=/.test(next)) next += "&connection_limit=5";
  if (!/[?&]pool_timeout=/.test(next)) next += "&pool_timeout=20";
  process.env.DATABASE_URL = next;
  return next;
}
