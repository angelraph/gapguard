"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StockBasis, MarketDataSource } from "@/lib/marketData/types";
import type { ReserveExposure } from "@/lib/kamino/exposure";

type RadarResponse = {
  generatedAt: string;
  source: MarketDataSource;
  stocks: StockBasis[];
  exposure: { total: number; byStock: ReserveExposure[] } | null;
  error?: string;
};

const SOURCE_LABEL: Record<MarketDataSource, string> = {
  pyth: "Pyth Network",
  free: "Jupiter + Yahoo Finance (free, while we wait on Pyth access)",
};

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const POLL_INTERVAL_MS = 30_000;

function formatPct(basis: number): string {
  const pct = basis * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatStaleness(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${(sec / 3600).toFixed(1)}h ago`;
}

/** Turn a raw error into something anyone can understand, not a stack trace. */
function friendlyErrorMessage(error: string): string {
  if (error.includes("PYTH_API_KEY")) {
    return "GapGuard needs a Pyth price key to fetch live data. Add one to .env.local (see docs/submission.md for how).";
  }
  if (error.includes("Not entitled") || error.includes("403")) {
    return "GapGuard's price data key doesn't yet have access to stock prices. This is a known, temporary setup issue, not a bug in the app. See docs/submission.md for what's going on.";
  }
  return "GapGuard couldn't load live prices just now. This usually fixes itself in a moment.";
}

export default function RadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/radar/summary", { cache: "no-store" });
        const json: RadarResponse = await res.json();
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setError(null);
          setData(json);
        }
      } catch {
        if (!cancelled) setError("Could not reach GapGuard's server. Try refreshing.");
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const closedCount = data?.stocks.filter((s) => s.marketLikelyClosed).length ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GapGuard</h1>
            <p className="text-sm text-zinc-400">
              Watching for price surprises in tokenized stocks on Solana
            </p>
          </div>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link href="/portfolio" className="hover:text-zinc-50">
              Your risk
            </Link>
            <Link href="/protect" className="hover:text-zinc-50">
              Gap Insurance
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        {error && (
          <div className="mb-8 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>{friendlyErrorMessage(error)}</p>
            <details className="mt-2 text-xs text-amber-300/60">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words">{error}</p>
            </details>
          </div>
        )}

        {data && (
          <p className="mb-6 text-xs text-zinc-500">
            Live price source right now: <span className="text-zinc-300">{SOURCE_LABEL[data.source]}</span>
          </p>
        )}

        <section className="mb-10 sm:mb-12">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Money sitting in tokenized stocks on Kamino right now
          </p>
          <div className="mt-2 text-4xl font-bold tabular-nums sm:text-6xl">
            {data?.exposure ? formatUsd(data.exposure.total) : "—"}
          </div>
          <p className="mt-2 max-w-xl text-zinc-400">
            {closedCount > 0
              ? `Right now, ${closedCount} of ${data?.stocks.length ?? 0} tracked stocks are trading on Solana while the real stock market is closed. That's exactly when a price surprise can happen with nobody watching.`
              : "This page compares each stock's real-world price to its on-chain token price, live."}
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Real price vs. on-chain price, live
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            "Gap" is how far apart the two prices are. A bigger gap, or an old
            "last updated" time, means more risk.
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-900 text-left text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Real price</th>
                  <th className="px-4 py-3 font-medium">On-chain price</th>
                  <th className="px-4 py-3 font-medium">Gap</th>
                  <th className="px-4 py-3 font-medium">Real price last updated</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                </tr>
              </thead>
              <tbody>
                {(data?.stocks ?? []).map((s) => (
                  <tr
                    key={s.ticker}
                    className="border-t border-zinc-800 hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/stock/${s.ticker}`}
                        className="font-medium hover:underline"
                      >
                        {s.ticker}
                      </Link>
                      <div className="text-xs text-zinc-500">{s.name}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      ${s.equityPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      ${s.xstockPrice.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums font-medium ${
                        Math.abs(s.basis) > 0.02
                          ? "text-amber-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {formatPct(s.basis)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-400">
                      {formatStaleness(s.equityStalenessSec)}
                    </td>
                    <td className="px-4 py-3">
                      {s.marketLikelyClosed ? (
                        <span className="rounded-full bg-red-950 px-2 py-1 text-xs text-red-300">
                          Closed
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-950 px-2 py-1 text-xs text-emerald-300">
                          Open
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!data && !error && (
                  <tr>
                    <td className="px-4 py-6 text-zinc-500" colSpan={6}>
                      Loading live prices…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-4 py-6 text-center text-xs text-zinc-600 sm:px-10">
        {data ? SOURCE_LABEL[data.source] : "Loading price source…"} · Built for the Stocklana hackathon.
      </footer>
    </div>
  );
}
