/**
 * A tiny bar that shows how big a gap is, next to its number. Grows out from
 * the left; sky when small, amber once it passes the warning size. The
 * number beside it carries the sign, so the bar only needs magnitude.
 */
export function GapBar({ gap, max = 0.05, warn = 0.02 }: { gap: number; max?: number; warn?: number }) {
  const pct = Math.min(Math.abs(gap) / max, 1) * 100;
  const hot = Math.abs(gap) > warn;
  return (
    <span aria-hidden className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-white/10 align-middle">
      <span
        className={`block h-full rounded-full ${hot ? "bg-[#ffb547]" : "bg-sky/80"}`}
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
    </span>
  );
}
