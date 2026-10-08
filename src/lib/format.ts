export function formatClock(ms: number) {
  const safe = Math.max(0, ms);
  const total = Math.ceil(safe / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const day = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (day === 0) return "Today";
  if (day === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function aiLabel(difficulty: string) {
  const name = difficulty.slice(0, 1).toUpperCase() + difficulty.slice(1);
  return `AI · ${name}`;
}
