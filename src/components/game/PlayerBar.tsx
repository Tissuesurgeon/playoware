import type { Player } from "@/engine/oware";
import { formatClock } from "@/lib/format";

export function PlayerBar({
  name,
  player,
  houses,
  seeds,
  clockMs,
  active,
  thinking,
  align = "left",
  status,
}: {
  name: string;
  player: Player;
  houses: number;
  seeds: number;
  clockMs?: number | null;
  active: boolean;
  thinking?: boolean;
  align?: "left" | "right";
  status?: string;
}) {
  const low = typeof clockMs === "number" && clockMs < 10_000;
  const south = player === "player1";
  const mark = south ? "bg-forest" : "bg-clay";
  const turn = south ? "text-forest" : "text-clay";
  const frame = active ? (south ? "bg-paper ring-2 ring-forest" : "bg-paper ring-2 ring-clay") : "";
  const label = status ?? (thinking ? "AI is thinking" : active ? "To move" : "Waiting");
  const houseWord = houses === 1 ? "house" : "houses";
  const seedWord = seeds === 1 ? "seed" : "seeds";

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 ${frame} ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-paper sm:h-11 sm:w-11 ${mark}`} aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold tracking-wide uppercase ${active || thinking ? turn : "text-ink-soft"}`}>{label}</p>
        <p className="truncate font-serif text-lg leading-tight sm:text-xl">{name}</p>
        {typeof clockMs === "number" ? (
          <p className={`font-serif text-sm tabular-nums ${low ? "text-bad" : "text-ink-soft"}`} aria-label={`${name} clock ${formatClock(clockMs)}`}>
            {formatClock(clockMs)}
          </p>
        ) : null}
      </div>
      <p className={`shrink-0 border-l border-line pl-3 text-right ${align === "right" ? "border-l-0 border-r pr-3 pl-0" : ""}`} aria-label={`${name}, ${houses} ${houseWord}, ${seeds} ${seedWord} captured`}>
        <span className="block font-serif text-3xl leading-none tabular-nums">{houses}</span>
        <span className="mt-1 block text-[11px] font-semibold tracking-wide text-ink-soft uppercase">{houseWord}</span>
        <span className="mt-1 block text-sm tabular-nums text-ink-soft">
          <span className="font-semibold text-ink">{seeds}</span> {seedWord}
        </span>
      </p>
    </div>
  );
}
