"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StockBasis, MarketDataSource } from "@/lib/marketData/types";
import type { ReserveExposure } from "@/lib/kamino/exposure";
import type { PreStock } from "@/lib/prestocks/client";

function formatValuation(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  return `$${(usd / 1e9).toFixed(1)}B`;
}

type RadarResponse = {
  generatedAt: string;
  source: MarketDataSource;
  stocks: StockBasis[];
  exposure: { total: number; byStock: ReserveExposure[] } | null;
  error?: string;
};

const SOURCE_LABEL: Record<MarketDataSource, string> = {
  pyth: "Pyth Network (real stock feed vs on-chain xStock feed)",
  free: "Jupiter + Yahoo Finance (backup source, used only if Pyth is unavailable)",
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

const WALKTHROUGH_STEPS = [
  {
    title: "Two versions of the same stock",
    body: "Stocks such as Apple or Tesla now have an on-chain equivalent that trades on Solana continuously, including nights and weekends.",
  },
  {
    title: "The real market keeps set hours",
    body: "The underlying shares only trade during normal market hours. While that market is closed, this page tracks any drift between the on-chain price and the last real price.",
  },
  {
    title: "Assess or hedge your exposure",
    body: "Connect a wallet under “Your risk” to review your own holdings, or use “Gap Insurance” to hedge against a sudden price move for a small fee.",
  },
];

export default function RadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preStocks, setPreStocks] = useState<PreStock[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pollPreStocks() {
      try {
        const res = await fetch("/api/prestocks", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.stocks) setPreStocks(json.stocks);
      } catch {
        // The pre-IPO section is additive; if it fails, the rest still works.
      }
    }

    async function poll() {
      pollPreStocks();
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
    <div className="flex flex-1 flex-col bg-bg-primary text-text-primary">
      <header className="border-b border-border px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GapGuard</h1>
            <p className="text-sm text-text-secondary">
              Watching for price surprises in tokenized stocks on Solana
            </p>
          </div>
          <nav className="flex gap-5 text-sm text-text-secondary">
            <Link href="/portfolio" className="hover:text-solana-purple">
              Your risk
            </Link>
            <Link href="/protect" className="hover:text-solana-purple">
              Gap Insurance
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        {/* Brief orientation for first-time visitors — a public landing page
            needs this, but it should read as documentation, not a tutorial. */}
        <section className="mb-10 border border-border sm:mb-12">
          <p className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-muted">
            How this works
          </p>
          <div className="divide-y divide-border">
            {WALKTHROUGH_STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4 px-5 py-4">
                <span className="font-mono text-sm text-text-muted">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{step.title}</p>
                  <p className="mt-0.5 text-sm text-text-secondary">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="mb-8 border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>{friendlyErrorMessage(error)}</p>
            <details className="mt-2 text-xs text-amber-300/60">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words font-mono">{error}</p>
            </details>
          </div>
        )}

        {data && (
          <p className="mb-6 text-xs text-text-muted">
            Live price source right now: <span className="text-text-secondary">{SOURCE_LABEL[data.source]}</span>
          </p>
        )}

        <section className="mb-10 sm:mb-12">
          <p className="text-sm uppercase tracking-wide text-text-muted">
            Money sitting in tokenized stocks on Kamino right now
          </p>
          <div className="mt-2 font-mono text-4xl font-bold tabular-nums text-solana-green sm:text-6xl">
            {data?.exposure ? formatUsd(data.exposure.total) : "—"}
          </div>
          <p className="mt-2 max-w-xl text-text-secondary">
            {closedCount > 0
              ? `Right now, ${closedCount} of ${data?.stocks.length ?? 0} tracked stocks are trading on Solana while the real stock market is closed. That's exactly when a price surprise can happen with nobody watching.`
              : "This page compares each stock's real-world price to its on-chain token price, live."}
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Real price vs. on-chain price, live
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            &quot;Gap&quot; is how far apart the two prices are. A bigger gap, or an old
            &quot;last updated&quot; time, means more risk.
          </p>
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-bg-elevated text-left text-text-secondary">
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
                    className="border-t border-border hover:bg-bg-card"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/stock/${s.ticker}`}
                        className="font-medium hover:text-solana-purple hover:underline"
                      >
                        {s.ticker}
                      </Link>
                      <div className="text-xs text-text-muted">{s.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      ${s.equityPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      ${s.xstockPrice.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono tabular-nums font-medium ${
                        Math.abs(s.basis) > 0.02
                          ? "text-amber-400"
                          : "text-text-secondary"
                      }`}
                    >
                      {formatPct(s.basis)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-secondary">
                      {formatStaleness(s.equityStalenessSec)}
                    </td>
                    <td className="px-4 py-3">
                      {s.marketLikelyClosed ? (
                        <span className="bg-red-950 px-2 py-1 text-xs text-red-300">
                          Closed
                        </span>
                      ) : (
                        <span className="bg-solana-green/10 px-2 py-1 text-xs text-solana-green">
                          Open
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!data && !error && (
                  <tr>
                    <td className="px-4 py-6 text-text-muted" colSpan={6}>
                      Loading live prices…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {preStocks && preStocks.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
              Pre-IPO tokens: issuer&apos;s price vs. on-chain price
            </h2>
            <p className="mb-4 max-w-2xl text-sm text-text-muted">
              Private companies like OpenAI and SpaceX have no market hours
              and no live price at all. Their token issuer (PreStocks)
              publishes a &quot;mark&quot;, its own estimate of the price,
              which only changes now and then. Meanwhile the token trades
              on Solana every second. The gap is the same risk as above,
              only permanent: whoever is on the wrong side of it finds out
              when the mark is next updated.
            </p>
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-bg-elevated text-left text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Issuer&apos;s mark</th>
                    <th className="px-4 py-3 font-medium">On-chain price</th>
                    <th className="px-4 py-3 font-medium">Gap</th>
                    <th className="px-4 py-3 font-medium">Valuation the token implies</th>
                  </tr>
                </thead>
                <tbody>
                  {[...preStocks]
                    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
                    .map((p) => (
                      <tr key={p.symbol} className="border-t border-border hover:bg-bg-card">
                        <td className="px-4 py-3">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-solana-purple hover:underline"
                          >
                            {p.company}
                          </a>
                          <div className="text-xs text-text-muted">{p.symbol}</div>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          ${p.markPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          ${p.tokenPrice.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono tabular-nums font-medium ${
                            Math.abs(p.gap) > 0.05 ? "text-amber-400" : "text-text-secondary"
                          }`}
                        >
                          {formatPct(p.gap)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-text-secondary">
                          {formatValuation(p.impliedValuationUsd)}
                          <span className="text-text-muted">
                            {" "}
                            vs {formatValuation(p.markValuationUsd)} marked
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Data from PreStocks&apos; public API, live. A positive gap means
              the token trades above the issuer&apos;s mark, a negative gap
              means below it.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-text-muted sm:px-10">
        {data ? SOURCE_LABEL[data.source] : "Loading price source…"} · Built for the Stocklana hackathon.
      </footer>
    </div>
  );
}
