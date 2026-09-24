"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StockBasis, MarketDataSource } from "@/lib/marketData/types";
import type { ReserveExposure } from "@/lib/kamino/exposure";
import type { PreStock } from "@/lib/prestocks/client";
import { SiteHeader } from "@/components/SiteHeader";

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

const SOURCE_SHORT: Record<MarketDataSource, string> = {
  pyth: "Pyth",
  free: "Backup",
};

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatValuation(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  return `$${(usd / 1e9).toFixed(1)}B`;
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

function gapTone(gap: number): string {
  return Math.abs(gap) > 0.02 ? "text-amber-300" : "text-mint";
}

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
  const tsla = data?.stocks.find((s) => s.ticker === "TSLA") ?? data?.stocks[0];
  const widestStock = data?.stocks.length
    ? [...data.stocks].sort((a, b) => Math.abs(b.basis) - Math.abs(a.basis))[0]
    : null;
  const widestPre = preStocks?.length
    ? [...preStocks].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0]
    : null;
  const trackedCount = (data?.stocks.length ?? 0) + (preStocks?.length ?? 0);

  return (
    <div className="relative flex flex-1 flex-col text-text-primary">
      <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[640px]" />
      <SiteHeader active="radar" />

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-10">
        {/* Hero */}
        <section className="grid items-center gap-12 pb-16 pt-8 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <p className="eyebrow">Gap risk for tokenized stocks</p>
            <h1 className="display mt-5 text-[2.75rem] sm:text-6xl lg:text-[4.4rem]">
              Tokenized stocks never sleep.{" "}
              <span className="text-gradient">The market does.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary">
              When the real stock market closes, the token keeps trading and
              nothing checks its price. GapGuard tracks that gap live on
              Pyth, shows what it means for your holdings, and lets you
              insure a weekend against a big move.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#radar" className="btn-primary">
                Open the Radar
              </a>
              <Link href="/protect" className="btn-ghost">
                Try Gap Insurance
              </Link>
            </div>

            <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-6">
              <div>
                <dt className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-text-muted">
                  Collateral on Kamino
                </dt>
                <dd className="mt-1.5 font-mono text-xl tabular-nums sm:text-2xl">
                  {data?.exposure ? formatUsd(data.exposure.total) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-text-muted">
                  Tokens tracked
                </dt>
                <dd className="mt-1.5 font-mono text-xl tabular-nums sm:text-2xl">
                  {trackedCount > 0 ? trackedCount : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-text-muted">
                  Price source
                </dt>
                <dd className="mt-1.5 font-mono text-xl sm:text-2xl">
                  {data ? SOURCE_SHORT[data.source] : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Fig. 1: a live look at one stock */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {widestStock && (
              <div className="glass absolute -right-2 -top-7 z-10 hidden rotate-[4deg] px-3.5 py-2 text-xs lg:block">
                <span className="font-semibold">{widestStock.ticker}</span>{" "}
                <span className={`font-mono ${gapTone(widestStock.basis)}`}>
                  {formatPct(widestStock.basis)}
                </span>
              </div>
            )}
            {widestPre && (
              <div className="glass absolute -bottom-10 -left-5 z-10 hidden -rotate-[5deg] px-3.5 py-2 text-xs lg:block">
                <span className="font-semibold">{widestPre.company}</span>{" "}
                <span className="font-mono text-amber-300">{formatPct(widestPre.gap)}</span>{" "}
                <span className="text-text-muted">vs mark</span>
              </div>
            )}

            <div className="glass p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{tsla?.ticker ?? "TSLA"}</p>
                  <p className="text-xs text-text-muted">
                    Tokenized stock · {tsla?.name ?? "Tesla Inc."}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-text-secondary">
                  {tsla ? (tsla.marketLikelyClosed ? "Market closed" : "Market open") : "Loading"}
                </span>
              </div>
            </div>

            <svg
              aria-hidden
              className="mx-auto block h-10 w-[70%]"
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M50 0V14M50 14H0V40M50 14H100V40"
                stroke="rgba(61,220,151,0.5)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass p-4">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-sky">
                  Real price
                </p>
                <p className="mt-2 font-mono text-2xl tabular-nums">
                  {tsla ? `$${tsla.equityPrice.toFixed(2)}` : "—"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  The real stock. Freezes when the market closes.
                </p>
              </div>
              <div className="glass p-4">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-mint">
                  On-chain price
                </p>
                <p className="mt-2 font-mono text-2xl tabular-nums">
                  {tsla ? `$${tsla.xstockPrice.toFixed(2)}` : "—"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  The token on Solana. Keeps moving, all week.
                </p>
              </div>
            </div>

            <div className="glass mt-3 flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
              <span className="text-text-secondary">The gap between them</span>
              <span className={`font-mono text-lg font-medium ${tsla ? gapTone(tsla.basis) : ""}`}>
                {tsla ? formatPct(tsla.basis) : "—"}
              </span>
            </div>
            <p className="mt-3 text-xs italic text-text-muted">
              Fig. 1 Both prices are read live from Pyth. When the real market
              is closed, the first one stops and the second keeps going. That
              growing gap is the risk.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="grid gap-8 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div>
            <p className="eyebrow">How this works</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">
              Two prices for one stock, and nobody watching the difference.
            </h2>
          </div>
          <div className="space-y-8">
            {WALKTHROUGH_STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] font-mono text-sm text-violet"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-text-secondary">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="mb-8 rounded-2xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>{friendlyErrorMessage(error)}</p>
            <details className="mt-2 text-xs text-amber-300/60">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words font-mono">{error}</p>
            </details>
          </div>
        )}

        {/* Radar */}
        <section id="radar" className="scroll-mt-6 pt-10">
          <p className="eyebrow">The Radar</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">Real price vs. on-chain price, live</h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            {closedCount > 0
              ? `Right now, ${closedCount} of ${data?.stocks.length ?? 0} tracked stocks are trading on Solana while the real stock market is closed. That's exactly when a price surprise can happen with nobody watching.`
              : "Each stock's real-world price next to its on-chain token price. A bigger gap, or an old “last updated” time, means more risk."}
          </p>

          <div className="mt-6 overflow-x-auto border border-border">
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
                  <tr key={s.ticker} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/stock/${s.ticker}`}
                        className="font-medium hover:text-mint hover:underline"
                      >
                        {s.ticker}
                      </Link>
                      <div className="text-xs text-text-muted">{s.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">${s.equityPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">${s.xstockPrice.toFixed(2)}</td>
                    <td className={`px-4 py-3 font-mono font-medium tabular-nums ${Math.abs(s.basis) > 0.02 ? "text-amber-300" : "text-text-secondary"}`}>
                      {formatPct(s.basis)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-secondary">
                      {formatStaleness(s.equityStalenessSec)}
                    </td>
                    <td className="px-4 py-3">
                      {s.marketLikelyClosed ? (
                        <span className="rounded-full bg-red-950/70 px-2.5 py-1 text-xs text-red-300">Closed</span>
                      ) : (
                        <span className="rounded-full bg-mint/10 px-2.5 py-1 text-xs text-mint">Open</span>
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
          {data && (
            <p className="mt-3 text-xs text-text-muted">
              Live price source right now:{" "}
              <span className="text-text-secondary">{SOURCE_LABEL[data.source]}</span>
            </p>
          )}
        </section>

        {/* Pre-IPO */}
        {preStocks && preStocks.length > 0 && (
          <section id="pre-ipo" className="scroll-mt-6 pt-20">
            <p className="eyebrow">Pre-IPO tokens</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">
              The issuer&apos;s price vs. the on-chain price
            </h2>
            <p className="mt-3 max-w-2xl text-text-secondary">
              Private companies like OpenAI and SpaceX have no market hours
              and no live price at all. Their token issuer (PreStocks)
              publishes a &quot;mark&quot;, its own estimate of the price,
              which only changes now and then. Meanwhile the token trades on
              Solana every second. The gap is the same risk as above, only
              permanent: whoever is on the wrong side of it finds out when the
              mark is next updated.
            </p>
            <div className="mt-6 overflow-x-auto border border-border">
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
                      <tr key={p.symbol} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-mint hover:underline"
                          >
                            {p.company}
                          </a>
                          <div className="text-xs text-text-muted">{p.symbol}</div>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">${p.markPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono tabular-nums">${p.tokenPrice.toFixed(2)}</td>
                        <td className={`px-4 py-3 font-mono font-medium tabular-nums ${Math.abs(p.gap) > 0.05 ? "text-amber-300" : "text-text-secondary"}`}>
                          {formatPct(p.gap)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-text-secondary">
                          {formatValuation(p.impliedValuationUsd)}
                          <span className="text-text-muted"> vs {formatValuation(p.markValuationUsd)} marked</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Data from PreStocks&apos; public API, live. A positive gap means
              the token trades above the issuer&apos;s mark, a negative gap
              means below it.
            </p>
          </section>
        )}

        {/* Closing call to action */}
        <section className="glass mt-24 flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="display text-2xl sm:text-3xl">Holding these over a weekend?</h2>
            <p className="mt-2 max-w-md text-text-secondary">
              See what a price jump would do to your wallet, or insure one
              stock against it for a small fee.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/portfolio" className="btn-ghost">
              Your risk
            </Link>
            <Link href="/protect" className="btn-primary">
              Gap Insurance
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative px-4 py-8 text-center text-xs text-text-muted sm:px-10">
        {data ? SOURCE_LABEL[data.source] : "Loading price source…"} · Built solo for the Stocklana hackathon.
      </footer>
    </div>
  );
}
