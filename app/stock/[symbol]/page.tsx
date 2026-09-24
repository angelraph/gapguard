import Link from "next/link";
import { notFound } from "next/navigation";
import { CURATED_STOCKS } from "@/lib/stocks/curatedList";
import { getMarketData } from "@/lib/marketData";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

function formatPct(basis: number): string {
  const pct = basis * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatStaleness(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} seconds ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} minutes ago`;
  return `${(sec / 3600).toFixed(1)} hours ago`;
}

/** One tokenized stock, live: the real price, the on-chain price, and the gap. */
export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const stock = CURATED_STOCKS.find(
    (s) => s.ticker.toLowerCase() === symbol.toLowerCase()
  );
  if (!stock) notFound();

  let live = null;
  let source: "pyth" | "free" | null = null;
  try {
    const data = await getMarketData();
    source = data.source;
    live = data.stocks.find((s) => s.ticker === stock.ticker) ?? null;
  } catch {
    live = null;
  }

  return (
    <div className="flex flex-1 flex-col text-text-primary">
      <SiteHeader active="radar" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4 sm:px-10">
        <Link href="/#radar" className="text-sm text-text-secondary hover:text-mint">
          ← Back to the Radar
        </Link>
        <p className="eyebrow mt-6">Tokenized stock</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          {stock.name} <span className="text-gradient">({stock.ticker})</span>
        </h1>
        <p className="mt-3 text-text-secondary">
          On-chain token:{" "}
          <span className="font-mono text-text-primary">{stock.xstockSymbol}</span>
        </p>

        {live ? (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="glass p-5">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-sky">
                  Real price
                </p>
                <p className="mt-2 font-mono text-3xl tabular-nums">
                  ${live.equityPrice.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Updated {formatStaleness(live.equityStalenessSec)}.{" "}
                  {live.marketLikelyClosed
                    ? "Regular trading is closed, so this price barely moves."
                    : "The real market is open."}
                </p>
              </div>
              <div className="glass p-5">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-mint">
                  On-chain price
                </p>
                <p className="mt-2 font-mono text-3xl tabular-nums">
                  ${live.xstockPrice.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  The token on Solana. It trades all day, every day.
                </p>
              </div>
            </div>
            <div className="glass mt-3 flex items-center justify-between px-5 py-4">
              <span className="text-text-secondary">The gap between them</span>
              <span
                className={`font-mono text-2xl font-medium ${
                  Math.abs(live.basis) > 0.02 ? "text-amber-300" : "text-mint"
                }`}
              >
                {formatPct(live.basis)}
              </span>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Live from {source === "pyth" ? "Pyth Network" : "Jupiter and Yahoo Finance (backup source)"}.
              Reload to refresh.
            </p>
          </>
        ) : (
          <div className="mt-8 border border-dashed border-border p-4 text-sm text-text-muted">
            Live prices for this stock couldn&apos;t load just now. Try again
            in a moment.
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/protect" className="btn-primary">
            Insure a weekend
          </Link>
          <Link href="/portfolio" className="btn-ghost">
            Your risk
          </Link>
        </div>
      </main>
    </div>
  );
}
