"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import type { PortfolioHolding } from "@/app/api/portfolio/[wallet]/route";
import { SiteHeader } from "@/components/SiteHeader";
import { GapBar } from "@/components/GapBar";

type ObligationSummary = {
  loanToValue: number;
  liquidationLtv: number;
  deposits: { mint: string; amountTokens: number; valueUsd: number }[];
  borrows: { mint: string; amountTokens: number; valueUsd: number }[];
};

type PortfolioResponse = {
  source: "pyth" | "free";
  holdings: PortfolioHolding[];
  obligation: ObligationSummary | null;
  error?: string;
};

function formatUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function formatGap(gap: number): string {
  const pct = gap * 100;
  if (Math.abs(pct) < 0.005) return "0.00%";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function PortfolioPage() {
  const { publicKey, connected } = useWallet();
  const [typed, setTyped] = useState("");
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gapPct, setGapPct] = useState(-10);

  // A looked-up public wallet wins over the connected one until cleared.
  const address = lookedUp ?? (connected && publicKey ? publicKey.toBase58() : null);
  const isLookup = lookedUp !== null;

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    try {
      new PublicKey(text);
      setLookedUp(text);
      setLookupError(null);
    } catch {
      setLookupError("That doesn't look like a Solana wallet address. Paste the long address of any wallet.");
    }
  }

  function clearLookup() {
    setLookedUp(null);
    setTyped("");
    setLookupError(null);
  }

  useEffect(() => {
    if (!address) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/portfolio/${address}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json: PortfolioResponse) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the holdings just now. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const totalValue = data?.holdings.reduce((sum, h) => sum + h.valueUsd, 0) ?? 0;
  const projectedChange = totalValue * (gapPct / 100);
  const projectedValue = totalValue + projectedChange;

  const projectedLtv =
    data?.obligation && data.obligation.deposits.length > 0
      ? (() => {
          const totalBorrowUsd = data.obligation.borrows.reduce((s, b) => s + b.valueUsd, 0);
          const totalDepositUsd = data.obligation.deposits.reduce((s, d) => s + d.valueUsd, 0);
          const projectedDepositUsd = totalDepositUsd * (1 + gapPct / 100);
          return projectedDepositUsd > 0 ? totalBorrowUsd / projectedDepositUsd : null;
        })()
      : null;

  return (
    <div className="flex flex-1 flex-col text-text-primary">
      <SiteHeader active="risk" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4 sm:px-10">
        <p className="eyebrow">Your risk</p>
        <h1 className="display mb-6 mt-3 text-4xl sm:text-5xl">
          What a sudden jump would do to <span className="text-gradient">a wallet</span>
        </h1>

        <div className="glass p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <div>
              <p className="text-sm font-medium">Connect your wallet</p>
              <p className="mt-1 text-sm text-text-secondary">
                See the tokenized stocks and pre-IPO tokens you hold.
              </p>
              <div className="mt-4">
                <WalletButton />
              </div>
            </div>
            <form onSubmit={handleLookup}>
              <p className="text-sm font-medium">Or look up any public wallet</p>
              <p className="mt-1 text-sm text-text-secondary">
                Read-only. Paste an address, nothing gets connected.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Wallet address"
                  aria-label="Wallet address to look up"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-bg-elevated px-4 py-2 font-mono text-sm"
                />
                <button type="submit" className="btn-ghost !px-5 !py-2 !text-sm">
                  Look up
                </button>
              </div>
              {lookupError && <p className="mt-2 text-xs text-amber-300">{lookupError}</p>}
            </form>
          </div>
        </div>

        {address && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
            <span className="text-text-secondary">
              Showing{" "}
              <span className="font-mono text-text-primary">{shorten(address)}</span>{" "}
              {isLookup ? "(a public wallet you looked up, read-only)" : "(your connected wallet)"}
            </span>
            {isLookup && (
              <button onClick={clearLookup} className="text-xs text-text-secondary underline hover:text-text-primary">
                Clear
              </button>
            )}
          </div>
        )}

        {address && loading && (
          <p className="mt-8 text-center text-sm text-text-muted">Loading the holdings…</p>
        )}

        {address && error && (
          <div className="mt-8 rounded-2xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {address && !loading && !error && data && data.holdings.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-text-muted">
            <p>
              This wallet doesn&apos;t hold any of the tokens GapGuard tracks: the
              8 tokenized stocks (Apple, Alphabet, Robinhood, MicroStrategy,
              Nvidia, QQQ, SPY, Tesla) or the 8 PreStocks pre-IPO tokens (OpenAI,
              Anthropic, SpaceX, Anduril and more).
            </p>
            <p className="mt-2">Try looking up a wallet that holds some.</p>
          </div>
        )}

        {address && !loading && !error && data && data.holdings.length > 0 && (
          <>
            <div className="glass mt-8 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Token</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Gap</th>
                    <th className="px-4 py-3 text-right font-medium">Value now</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => (
                    <tr key={h.mint} className="border-t border-white/[0.06]">
                      <td className="px-4 py-3">
                        <span className="font-medium">{h.ticker}</span>
                        <div className="text-xs text-text-muted">
                          {h.name}
                          {h.kind === "pre-ipo" && (
                            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                              Pre-IPO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {h.amountTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-3">
                          <GapBar
                            gap={h.basis}
                            max={h.kind === "pre-ipo" ? 0.35 : 0.05}
                            warn={h.kind === "pre-ipo" ? 0.05 : 0.02}
                          />
                          <span
                            className={`w-16 font-mono tabular-nums ${
                              Math.abs(h.basis) > (h.kind === "pre-ipo" ? 0.05 : 0.02)
                                ? "text-amber-300"
                                : "text-text-secondary"
                            }`}
                          >
                            {formatGap(h.basis)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatUsd(h.valueUsd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 font-medium">
                    <td className="px-4 py-3" colSpan={3}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatUsd(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="glass mt-6 p-5 sm:p-6">
              <label className="block text-sm text-text-secondary" htmlFor="risk-slider">
                If every token here suddenly moved by{" "}
                <span className="font-mono text-text-primary">
                  {gapPct > 0 ? "+" : ""}
                  {gapPct}%
                </span>
                , here&apos;s what would happen:
              </label>
              <input
                id="risk-slider"
                type="range"
                min={-20}
                max={20}
                value={gapPct}
                onChange={(e) => setGapPct(Number(e.target.value))}
                className="mt-4 w-full"
              />

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.05] p-4">
                  <p className="text-xs uppercase tracking-wide text-text-muted">The holdings would be worth</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatUsd(projectedValue)}</p>
                  <p
                    className={`mt-1 font-mono text-sm tabular-nums ${
                      projectedChange < 0 ? "text-amber-300" : "text-mint"
                    }`}
                  >
                    {projectedChange >= 0 ? "+" : ""}
                    {formatUsd(projectedChange)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.05] p-4">
                  <p className="text-xs uppercase tracking-wide text-text-muted">Kamino loan safety</p>
                  {data.obligation && projectedLtv !== null ? (
                    <>
                      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                        {formatPct(projectedLtv)}
                        <span className="text-sm font-normal text-text-muted">
                          {" "}
                          of {formatPct(data.obligation.liquidationLtv)} limit
                        </span>
                      </p>
                      <p
                        className={`mt-1 text-sm ${
                          projectedLtv >= data.obligation.liquidationLtv ? "text-amber-300" : "text-mint"
                        }`}
                      >
                        {projectedLtv >= data.obligation.liquidationLtv
                          ? "This would trigger a liquidation."
                          : "Safe at this level."}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-text-muted">
                      No loan against these tokens on Kamino, so there&apos;s no liquidation risk to show.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
