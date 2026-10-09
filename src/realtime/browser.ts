export function socketUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const page = window.location;
  const protocol = page.protocol === "https:" ? "wss:" : "ws:";
  if (process.env.NODE_ENV === "development") return `${protocol}//${page.hostname}:3001`;
  return `${protocol}//${page.host}`;
}
