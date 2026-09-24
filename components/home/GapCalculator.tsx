"use client";

import { useState } from "react";

const TRIGGER_PCT = 3;

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * A no-wallet way to feel the risk: pick a position and a weekend move and
 * see what it does. It only does arithmetic, with no data behind it.
 */
export function GapCalculator() {
  const [position, setPosition] = useState(10000);
  const [gap, setGap] = useState(-8);

  const change = position * (gap / 100);
  const after = position + change;
  const triggers = Math.abs(gap) > TRIGGER_PCT;

  return (
    <div className="glass p-5 sm:p-7">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-text-secondary" htmlFor="calc-position">
            You hold, in dollars
          </label>
          <input
            id="calc-position"
            type="number"
            min={0}
            step={100}
            value={position}
            onChange={(e) => setPosition(Math.max(0, Number(e.target.value)))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-bg-elevated px-3.5 py-2.5 font-mono text-lg"
          />

          <label className="mt-6 block text-sm text-text-secondary" htmlFor="calc-gap">
            Monday morning, the price opens{" "}
            <span className="font-mono text-text-primary">
              {gap > 0 ? "+" : ""}
              {gap}%
            </span>{" "}
            from Friday&apos;s close
          </label>
          <input
            id="calc-gap"
            type="range"
            min={-20}
            max={20}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="mt-3 w-full accent-[#b8f56b]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-text-muted">
            <span>-20%</span>
            <span>0</span>
            <span>+20%</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[-10, -5, -2, 2, 5, 10].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGap(p)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  gap === p
                    ? "border-mint/60 bg-mint/10 text-mint"
                    : "border-white/12 text-text-secondary hover:border-white/30"
                }`}
              >
                {p > 0 ? "+" : ""}
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Your position becomes</p>
          <p className="mt-2 font-mono text-4xl tabular-nums">{usd(after)}</p>
          <p className={`mt-1 font-mono text-lg tabular-nums ${change < 0 ? "text-[#ffb547]" : "text-mint"}`}>
            {change >= 0 ? "+" : ""}
            {usd(change)}
          </p>
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-text-secondary">
            {triggers
              ? `A move this size is past the ${TRIGGER_PCT}% trigger, so Gap Insurance on this stock would pay out.`
              : `A move this size is inside the ${TRIGGER_PCT}% trigger, so Gap Insurance would not pay out.`}
          </p>
        </div>
      </div>
    </div>
  );
}
