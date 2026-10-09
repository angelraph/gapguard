"use client";

import Link from "next/link";
import type { MarketDataSource } from "@/lib/marketData/types";
import { GapBar } from "@/components/GapBar";
import { RadarPlot, type RadarPoint } from "@/components/home/RadarPlot";
import { TickerTape, type TapeItem } from "@/components/home/TickerTape";
import { useRadarData } from "@/lib/useLiveData";
import { formatPct, formatStaleness, formatUsdShort, formatValuation } from "@/lib/format";

const SOURCE_LABEL: Record<MarketDataSource, string> = {
  pyth: "Pyth Network (real stock feed vs on-chain xStock feed)",
  free: "Jupiter + Yahoo Finance (free source, used while Pyth stock data isn't available)",
};

/** Turn a raw error into something anyone can understand, not a stack trace. */
function friendlyErrorMessage(error: string): string {
  if (error.includes("Not entitled") || error.includes("403")) {
    return "GapGuard's price data key doesn't yet have access to stock prices. This is a known setup issue, not a bug in the app.";
  }
  return "GapGuard couldn't load live prices just now. This usually fixes itself in a moment.";
}

export default function RadarPage() {
  const { data, error, preStocks, preStocksAge } = useRadarData();

  const closedCount = data?.stocks.filter((s) => s.marketLikelyClosed).length ?? 0;
  const radarPoints: RadarPoint[] = [
    ...(data?.stocks ?? []).map((s) => ({ label: s.ticker, gap: s.basis, kind: "stock" as const })),
    ...(preStocks ?? []).map((p) => ({ label: p.symbol, gap: p.gap, kind: "pre-ipo" as const })),
  ];
  const tapeItems: TapeItem[] = [
    ...(data?.stocks ?? []).map((s) => ({ label: s.ticker, gap: s.basis })),
    ...(preStocks ?? []).map((p) => ({ label: p.symbol, gap: p.gap, note: "vs issuer mark" })),
  ];

  return (
    <>
      <TickerTape items={tapeItems} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-8 sm:px-8">
        <section className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">Gap radar</p>
            <h1 className="display mt-4 text-4xl sm:text-5xl">Real price vs. on-chain price, live.</h1>
            <p className="mt-4 max-w-lg text-text-secondary">
              {closedCount > 0
                ? `Right now ${closedCount} of ${data?.stocks.length ?? 0} tracked stocks are trading on Solana while the real market is closed. That's when a surprise can build up with nobody checking.`
                : "Each stock's real price next to its token's price on Solana. The further a dot sits from the centre, the bigger the gap."}
            </p>
            {data?.exposure && (
              <p className="mt-5 text-sm text-text-muted">
                {formatUsdShort(data.exposure.total)} is lent against these tokens on Kamino right now.
              </p>
            )}
          </div>
          <RadarPlot points={radarPoints} />
        </section>

        {error && (
          <div className="mt-8 rounded-2xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>{friendlyErrorMessage(error)}</p>
            <details className="mt-2 text-xs text-amber-300/60">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words font-mono">{error}</p>
            </details>
          </div>
        )}

        <section id="stocks" className="scroll-mt-28 pt-14">
          <h2 className="text-xl font-semibold">Tokenized stocks</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
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
                      <Link href={`/stock/${s.ticker}`} className="font-medium hover:text-mint hover:underline">
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
              Live price source right now: <span className="text-text-secondary">{SOURCE_LABEL[data.source]}</span>
            </p>
          )}
        </section>

        {preStocks && preStocks.length > 0 && (
          <section id="pre-ipo" className="scroll-mt-28 pt-14">
            <h2 className="text-xl font-semibold">Pre-IPO tokens</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Private companies like OpenAI and SpaceX have no market at all. Their token issuer (PreStocks) publishes
              its own estimate of the price, the &quot;mark&quot;, and updates it now and then. The token trades every
              second. Whoever is on the wrong side of the gap finds out when the mark next moves.
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
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
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-mint hover:underline">
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
            {preStocksAge >= 1 && (
              <p className="mt-3 text-xs text-amber-300">
                PreStocks is briefly unavailable, so these are the last prices we got,{" "}
                {preStocksAge === 1 ? "1 minute" : `${preStocksAge} minutes`} ago. They update again as soon as it&apos;s back.
              </p>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Data from PreStocks&apos; public API, live. A positive gap means the token trades above the issuer&apos;s
              mark, a negative gap means below it.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
