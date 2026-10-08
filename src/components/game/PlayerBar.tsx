import { formatClock } from "@/lib/format";

export function PlayerBar({
  name,
  clockMs,
  active,
  thinking,
  align = "left",
}: {
  name: string;
  clockMs: number;
  active: boolean;
  thinking?: boolean;
  align?: "left" | "right";
}) {
  const low = clockMs < 10_000;
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-walnut text-sm font-semibold text-paper" aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          {thinking ? "AI is thinking" : active ? "To move" : "Waiting"}
        </p>
        <p className="truncate font-serif text-xl leading-tight">{name}</p>
        <p className="text-sm text-ink-soft">Unrated</p>
      </div>
      <p className={`font-serif text-2xl tabular-nums ${low ? "text-bad" : ""}`} aria-label={`${name} clock ${formatClock(clockMs)}`}>
        {formatClock(clockMs)}
      </p>
    </div>
  );
}
