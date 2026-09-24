export type TapeItem = {
  label: string;
  gap: number;
  note?: string;
};

function pct(gap: number): string {
  return `${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(2)}%`;
}

/** A slow, pausable strip of live gaps across the top of the page. */
export function TickerTape({ items }: { items: TapeItem[] }) {
  if (items.length === 0) return null;

  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 px-6 text-xs">
          <span className="font-semibold tracking-wide text-text-primary">{it.label}</span>
          <span
            className={`font-mono tabular-nums ${
              Math.abs(it.gap) > 0.03 ? "text-[#ffb547]" : "text-mint"
            }`}
          >
            {pct(it.gap)}
          </span>
          {it.note && <span className="text-text-muted">{it.note}</span>}
          <span className="pl-6 text-white/15">/</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className="tape relative overflow-hidden border-y border-white/[0.06] bg-black/30 py-2.5"
      aria-label="Live price gaps"
    >
      <div className="tape-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
