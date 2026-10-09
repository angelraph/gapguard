"use client";

import { useState } from "react";
import type { Census } from "@/lib/kamino/census";
import { formatUsdShort, minutesAgo } from "@/lib/format";

/**
 * The Monday shock map: pick how far tokenized stocks open lower, and see how
 * many real Kamino borrowers that would liquidate. Each bar is one drop size.
 * Colour shows how ordinary that move is: red for drops a volatile stock can
 * make over any weekend, cooling off for rarer, bigger moves.
 */
function heat(drop: number): string {
  if (drop <= 0.06) return "bg-red-400";
  if (drop <= 0.12) return "bg-orange-400";
  if (drop <= 0.2) return "bg-amber-300";
  return "bg-sky";
}

/** `census` is undefined while loading, and null when Kamino couldn't be read. */
export function ShockMap({ census, now }: { census: Census | null | undefined; now: number | null }) {
  const [picked, setPicked] = useState(0.1);

  if (census === null) {
    return (
      <div className="glass flex min-h-[200px] flex-col justify-center p-6">
        <p className="eyebrow">Monday shock map</p>
        <p className="mt-3 text-sm text-text-secondary">
          Couldn&apos;t read Kamino&apos;s loans just now. The free Solana connection is busy; this page tries again
          every minute.
        </p>
      </div>
    );
  }

  if (census === undefined) {
    return (
      <div className="glass flex min-h-[340px] flex-col justify-center p-6">
        <p className="eyebrow">Monday shock map</p>
        <p className="mt-3 text-sm text-text-muted">
          Reading every loan on Kamino&apos;s xStocks market. The first read takes about half a minute…
        </p>
        <div className="mt-5 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-white/[0.05]" style={{ width: `${30 + i * 11}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const rows = census.rows;
  const max = Math.max(1, ...rows.map((r) => r.borrowers));
  const row = rows.find((r) => r.drop === picked) ?? rows[0];
  const share = census.borrowers ? row.borrowers / census.borrowers : 0;

  return (
    <div className="glass p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Monday shock map</p>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">If stocks open lower on Monday, who gets liquidated?</h2>
        </div>
        <span className="chip text-text-muted">
          {census.borrowers.toLocaleString()} real loans · read {now ? `${minutesAgo(census.at, now)} min ago` : "recently"}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* The readout for the picked drop */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-5">
          <div>
            <p className="text-sm text-text-secondary">
              A <span className="font-mono text-text-primary">{Math.round(picked * 100)}%</span> drop at the open would liquidate
            </p>
            <p className="mt-2 font-mono text-5xl font-semibold tabular-nums sm:text-6xl">
              {row.borrowers.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              borrowers, with <span className="font-mono text-text-primary">{formatUsdShort(row.borrowedUsd)}</span> borrowed
              {" "}({(share * 100).toFixed(1)}% of all loans).
            </p>
          </div>
          <div className="mt-6">
            <label htmlFor="shock" className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Drop at Monday&apos;s open
            </label>
            <input
              id="shock"
              type="range"
              min={0}
              max={rows.length - 1}
              value={rows.findIndex((r) => r.drop === picked)}
              onChange={(e) => setPicked(rows[Number(e.target.value)].drop)}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-text-muted">
              <span>-{Math.round(rows[0].drop * 100)}%</span>
              <span>-{Math.round(rows[rows.length - 1].drop * 100)}%</span>
            </div>
          </div>
        </div>

        {/* One bar per drop size */}
        <ol className="space-y-1.5">
          {rows.map((r) => {
            const active = r.drop === picked;
            return (
              <li key={r.drop}>
                <button
                  type="button"
                  onClick={() => setPicked(r.drop)}
                  className={`grid w-full grid-cols-[3.2rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                  }`}
                  aria-pressed={active}
                >
                  <span className={`font-mono text-sm tabular-nums ${active ? "text-text-primary" : "text-text-secondary"}`}>
                    -{Math.round(r.drop * 100)}%
                  </span>
                  <span className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
                    <span
                      className={`block h-full rounded-full ${heat(r.drop)} ${active ? "" : "opacity-70"}`}
                      style={{ width: `${Math.max(r.borrowers ? 2 : 0, (r.borrowers / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-[7.5rem] text-right font-mono text-xs tabular-nums text-text-secondary">
                    {r.borrowers} · {formatUsdShort(r.borrowedUsd)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-text-muted">
        Red marks drops a volatile stock can make over an ordinary weekend; cooler colours are rarer, bigger moves.
        Every loan on Kamino&apos;s xStocks market, read live and priced the way Kamino prices liquidations. Assumes a
        borrower&apos;s stock collateral falls together; Bitcoin or USDC they also deposited holds its value.{" "}
        {census.notStockExposed > 0 &&
          `${census.notStockExposed} loans are mostly backed by other assets, so a stock drop can't liquidate them.`}
      </p>
    </div>
  );
}
