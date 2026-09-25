"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StockBasis, MarketDataSource } from "@/lib/marketData/types";
import type { ReserveExposure } from "@/lib/kamino/exposure";
import type { PreStock } from "@/lib/prestocks/client";
import { SiteHeader } from "@/components/SiteHeader";
import { GapBar } from "@/components/GapBar";
import { RadarPlot, type RadarPoint } from "@/components/home/RadarPlot";
import { TickerTape, type TapeItem } from "@/components/home/TickerTape";
import { WeekStrip } from "@/components/home/WeekStrip";
import { GapCalculator } from "@/components/home/GapCalculator";
import { Roadmap } from "@/components/home/Roadmap";
import { Faq } from "@/components/home/Faq";

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

function formatValuation(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  return `$${(usd / 1e9).toFixed(1)}B`;
}

const POLL_INTERVAL_MS = 30_000;

function formatPct(basis: number): string {
  const pct = basis * 100;
  // Avoid showing "-0.00%" for a gap that rounds to nothing.
  if (Math.abs(pct) < 0.005) return "0.00%";
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

const INSURANCE_STEPS = [
  {
    title: "Buy protection",
    body: "Pay a small fee in USDC for one stock and one weekend. You receive protection tokens from a Meteora bonding curve.",
  },
  {
    title: "The window runs",
    body: "From Friday's close to Monday's open, the real market is shut and the token keeps trading.",
  },
  {
    title: "Pyth settles it",
    body: "The close and the open are read from Pyth's price history and written into a Solana transaction, timestamps included.",
  },
  {
    title: "Paid, or the fee is kept",
    body: "A move past 3% pays protection holders back. Anything smaller and the pool keeps the fees.",
  },
];

const WHY_SOLANA = [
  {
    title: "It trades around the clock",
    body: "The problem only exists because these tokens settle in seconds, every hour of every day.",
  },
  {
    title: "The data is already on-chain",
    body: "Pyth prices both the real stock and the token, and Kamino holds the collateral, all natively on Solana.",
  },
  {
    title: "Cheap enough to insure a weekend",
    body: "A protection purchase costs a fraction of a cent in fees, so small positions can be protected too.",
  },
];

const WHY_ICONS = [
  <svg key="clock" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.9 4.2v3.6l2.6 1.5-.9 1.5-3.4-2V6.2h1.7z" />
  </svg>,
  <svg key="link" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M8.5 5.2a3.6 3.6 0 015.1 0l1.2 1.2a3.6 3.6 0 010 5.1l-1 1-1.3-1.3 1-1a1.8 1.8 0 000-2.5l-1.2-1.2a1.8 1.8 0 00-2.5 0l-1 1L7.5 6.2l1-1zm3 9.6a3.6 3.6 0 01-5.1 0L5.2 13.6a3.6 3.6 0 010-5.1l1-1 1.3 1.3-1 1a1.8 1.8 0 000 2.5l1.2 1.2a1.8 1.8 0 002.5 0l1-1 1.3 1.3-1 1z" />
  </svg>,
  <svg key="coin" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.8 3.6v.7c1.1.2 1.9.9 2 1.9h-1.5c-.1-.4-.5-.7-1.2-.7-.7 0-1.1.3-1.1.7 0 .5.4.7 1.6 1 1.5.4 2.4.9 2.4 2.1 0 1-.8 1.7-2 1.9v.7H9.2v-.7c-1.2-.2-2-.9-2.1-2h1.5c.1.5.6.8 1.4.8.7 0 1.2-.3 1.2-.8s-.4-.7-1.6-1c-1.4-.4-2.3-.9-2.3-2.1 0-1 .8-1.7 1.9-1.9v-.7h1.6z" />
  </svg>,
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
  const tsla = data?.stocks.find((s) => s.ticker === "TSLA") ?? null;
  const widestStock = data?.stocks.length
    ? [...data.stocks].sort((a, b) => Math.abs(b.basis) - Math.abs(a.basis))[0]
    : null;
  const widestPre = preStocks?.length
    ? [...preStocks].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0]
    : null;

  const radarPoints: RadarPoint[] = [
    ...(data?.stocks ?? []).map((s) => ({ label: s.ticker, gap: s.basis, kind: "stock" as const })),
    ...(preStocks ?? []).map((p) => ({ label: p.symbol, gap: p.gap, kind: "pre-ipo" as const })),
  ];
  const tapeItems: TapeItem[] = [
    ...(data?.stocks ?? []).map((s) => ({ label: s.ticker, gap: s.basis })),
    ...(preStocks ?? []).map((p) => ({ label: p.symbol, gap: p.gap, note: "vs issuer mark" })),
  ];

  return (
    <div className="relative flex flex-1 flex-col text-text-primary">
      <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[700px]" />
      <SiteHeader active="radar" />
      <TickerTape items={tapeItems} />

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-10">
        {/* Hero */}
        <section className="grid items-center gap-10 pb-14 pt-10 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-6">
          <div>
            <p className="eyebrow">Gap risk radar · Solana</p>
            <h1 className="display mt-5 text-[2.9rem] sm:text-6xl lg:text-[4.6rem]">
              While the market sleeps,{" "}
              <span className="text-gradient">the price doesn&apos;t.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-text-secondary">
              Tokenized stocks trade around the clock on Solana. The real market keeps
              office hours. GapGuard shows the gap between them, live, and lets you
              insure a weekend against it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/protect" className="btn-primary">
                Insure a weekend
              </Link>
              <a href="#radar" className="btn-ghost">
                See the live radar
              </a>
            </div>
            <p className="mt-8 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-white/10 px-4 py-2 text-xs text-text-secondary">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
                </span>
                {data ? `Live on ${data.source === "pyth" ? "Pyth" : "backup feed"}` : "Connecting"}
              </span>
              <span className="text-white/20">/</span>
              <span>{radarPoints.length || "16"} tokens on the radar</span>
              {data?.exposure && (
                <>
                  <span className="text-white/20">/</span>
                  <span>{formatUsd(data.exposure.total)} lent against them on Kamino</span>
                </>
              )}
            </p>
          </div>

          <div className="relative">
            {tsla && (
              <div className="glass absolute -left-1 top-6 z-10 hidden -rotate-6 items-center gap-2 px-3.5 py-2 text-xs lg:flex">
                <span className="font-semibold">{tsla.ticker}</span>
                <span className={`font-mono tabular-nums ${Math.abs(tsla.basis) > 0.03 ? "text-amber-300" : "text-mint"}`}>
                  {formatPct(tsla.basis)}
                </span>
              </div>
            )}
            {widestPre && (
              <div className="glass absolute -right-2 top-[38%] z-10 hidden rotate-[7deg] items-center gap-2 px-3.5 py-2 text-xs lg:flex">
                <span className="font-semibold">{widestPre.company}</span>
                <span className="font-mono tabular-nums text-amber-300">{formatPct(widestPre.gap)}</span>
                <span className="text-text-muted">vs mark</span>
              </div>
            )}
            {widestStock && (
              <div className="glass absolute bottom-16 left-2 z-10 hidden rotate-[4deg] items-center gap-2 px-3.5 py-2 text-xs lg:flex">
                <span className="font-semibold">{widestStock.ticker}</span>
                <span className={`font-mono tabular-nums ${Math.abs(widestStock.basis) > 0.03 ? "text-amber-300" : "text-mint"}`}>
                  {formatPct(widestStock.basis)}
                </span>
                <span className="text-text-muted">widest today</span>
              </div>
            )}
            <RadarPlot points={radarPoints} />
          </div>
        </section>

        {/* Why the gap exists */}
        <section id="why" className="scroll-mt-24 pt-10">
          <p className="eyebrow">Why the gap exists</p>
          <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">
            The stock works office hours. The token works every hour.
          </h2>
          <p className="mb-8 mt-4 max-w-2xl text-text-secondary">
            A stock like Tesla trades about 32 hours a week. Its token on Solana
            trades all 168. In every hour that isn&apos;t lime below, the real price
            barely moves (and not at all on weekends) while the token keeps
            moving, and nothing checks it until the market reopens.
          </p>
          <WeekStrip />
        </section>

        {error && (
          <div className="mt-10 rounded-2xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>{friendlyErrorMessage(error)}</p>
            <details className="mt-2 text-xs text-amber-300/60">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words font-mono">{error}</p>
            </details>
          </div>
        )}

        {/* Radar table */}
        <section id="radar" className="scroll-mt-24 pt-24">
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
                  <th className="px-4 py-3 text-right font-medium">Real price</th>
                  <th className="px-4 py-3 text-right font-medium">On-chain price</th>
                  <th className="px-4 py-3 text-right font-medium">Gap</th>
                  <th className="px-4 py-3 text-right font-medium">Real price updated</th>
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
                    <td className="px-4 py-3 text-right font-mono tabular-nums">${s.equityPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">${s.xstockPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-3">
                        <GapBar gap={s.basis} />
                        <span
                          className={`w-16 font-mono font-medium tabular-nums ${
                            Math.abs(s.basis) > 0.02 ? "text-amber-300" : "text-text-secondary"
                          }`}
                        >
                          {formatPct(s.basis)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-secondary">
                      {formatStaleness(s.equityStalenessSec)}
                    </td>
                    <td className="px-4 py-3">
                      {s.marketLikelyClosed ? (
                        <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-text-secondary">Closed</span>
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
          <section id="pre-ipo" className="scroll-mt-24 pt-20">
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
                    <th className="px-4 py-3 text-right font-medium">Issuer&apos;s mark</th>
                    <th className="px-4 py-3 text-right font-medium">On-chain price</th>
                    <th className="px-4 py-3 text-right font-medium">Gap</th>
                    <th className="px-4 py-3 text-right font-medium">Valuation the token implies</th>
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
                        <td className="px-4 py-3 text-right font-mono tabular-nums">${p.markPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">${p.tokenPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-end gap-3">
                            <GapBar gap={p.gap} max={0.35} warn={0.05} />
                            <span
                              className={`w-16 font-mono font-medium tabular-nums ${
                                Math.abs(p.gap) > 0.05 ? "text-amber-300" : "text-text-secondary"
                              }`}
                            >
                              {formatPct(p.gap)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-secondary">
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

        {/* Calculator */}
        <section id="calculator" className="scroll-mt-24 pt-24">
          <p className="eyebrow">Feel the gap</p>
          <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">
            What would a weekend move do to you?
          </h2>
          <p className="mb-6 mt-3 max-w-2xl text-text-secondary">
            No wallet needed. Pick a position and a move and see it. Connect a
            wallet on Your risk to see it with your real holdings.
          </p>
          <GapCalculator />
        </section>

        {/* Gap Insurance */}
        <section id="insurance" className="scroll-mt-24 pt-24">
          <p className="eyebrow">Gap Insurance</p>
          <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">
            One stock, one weekend, one clear rule.
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INSURANCE_STEPS.map((step, i) => (
              <li key={step.title} className="glass relative p-5">
                {i < INSURANCE_STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -right-[19px] top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-bg-primary text-xs text-text-secondary lg:flex"
                  >
                    →
                  </span>
                )}
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-mint/15 font-mono text-xs text-mint">
                  {i + 1}
                </span>
                <p className="mt-3 font-semibold">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/protect" className="btn-primary">
              Try it on the free test network
            </Link>
            <span className="text-sm text-text-muted">
              Also live on mainnet with real USDC. Not audited.
            </span>
          </div>
        </section>

        {/* Why Solana */}
        <section className="grid gap-10 pt-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Why Solana</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">
              This problem only exists because of how Solana works.
            </h2>
          </div>
          <div className="space-y-9">
            {WHY_SOLANA.map((w, i) => (
              <div key={w.title} className="flex gap-4">
                <span className="icon-tile" aria-hidden>
                  {WHY_ICONS[i]}
                </span>
                <div>
                  <p className="font-semibold">{w.title}</p>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-text-secondary">{w.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="scroll-mt-24 pt-24">
          <p className="eyebrow">Roadmap</p>
          <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">
            From a working hackathon build to a market you don&apos;t have to trust me on.
          </h2>
          <p className="mb-8 mt-3 max-w-2xl text-text-secondary">
            What is live today, and what it takes to make it something people
            can rely on.
          </p>
          <Roadmap />
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 pt-24">
          <p className="eyebrow">FAQ</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">Questions, answered plainly.</h2>
          <div className="mt-8">
            <Faq />
          </div>
        </section>

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

      <footer className="relative border-t border-white/[0.06] px-4 py-10 sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-8 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-semibold">GapGuard</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
              A gap risk radar and weekend insurance for tokenized stocks on Solana. Built solo
              for the Stocklana hackathon. A hackathon project, not audited.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Project</p>
            <ul className="mt-3 space-y-2 text-text-secondary">
              <li><a className="hover:text-text-primary" href="https://github.com/angelraph/gapguard" target="_blank" rel="noopener noreferrer">Code on GitHub</a></li>
              <li><a className="hover:text-text-primary" href="https://github.com/angelraph/gapguard/blob/master/docs/submission.md" target="_blank" rel="noopener noreferrer">Full write-up</a></li>
              <li><Link className="hover:text-text-primary" href="/protect">Gap Insurance</Link></li>
              <li><Link className="hover:text-text-primary" href="/portfolio">Your risk</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Built with</p>
            <ul className="mt-3 space-y-2 text-text-secondary">
              <li><a className="hover:text-text-primary" href="https://pyth.network" target="_blank" rel="noopener noreferrer">Pyth Network</a></li>
              <li><a className="hover:text-text-primary" href="https://www.meteora.ag" target="_blank" rel="noopener noreferrer">Meteora</a></li>
              <li><a className="hover:text-text-primary" href="https://prestocks.com" target="_blank" rel="noopener noreferrer">PreStocks</a></li>
              <li><a className="hover:text-text-primary" href="https://kamino.finance" target="_blank" rel="noopener noreferrer">Kamino</a></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs text-text-muted">
          Live price source: {data ? SOURCE_LABEL[data.source] : "loading…"}
        </p>
      </footer>
    </div>
  );
}
