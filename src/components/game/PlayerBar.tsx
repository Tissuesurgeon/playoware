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

  const figure = "shrink-0 text-right";
  const figureValue = "font-serif text-xl leading-none tabular-nums";
  const figureLabel = "mt-0.5 block text-[10px] font-semibold tracking-wide text-ink-soft uppercase";

  return (
    <div className={`flex items-center gap-2 rounded-2xl px-2 py-1 ${frame} ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-paper sm:h-9 sm:w-9 ${mark}`} aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold tracking-wide uppercase ${active || thinking ? turn : "text-ink-soft"}`}>{label}</p>
        <p className="truncate font-serif text-base leading-tight sm:text-lg">{name}</p>
        {typeof clockMs === "number" ? (
          <p className={`font-serif text-sm tabular-nums ${low ? "text-bad" : "text-ink-soft"}`} aria-label={`${name} clock ${formatClock(clockMs)}`}>
            {formatClock(clockMs)}
          </p>
        ) : null}
      </div>
      <p className={figure} aria-label={`${name}, ${houses} ${houseWord}`}>
        <span className={figureValue}>{houses}</span>
        <span className={figureLabel}>{houseWord}</span>
      </p>
      <p className={figure} aria-label={`${name}, ${seeds} ${seedWord} captured`}>
        <span className={figureValue}>{seeds}</span>
        <span className={figureLabel}>{seedWord}</span>
      </p>
    </div>
  );
}
