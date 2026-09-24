"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { PortfolioHolding } from "@/app/api/portfolio/[wallet]/route";
import { useNetwork } from "@/lib/network";

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


export default function PortfolioPage() {
  const { publicKey, connected } = useWallet();
  const IS_DEVNET = useNetwork().config.isDevnet;
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gapPct, setGapPct] = useState(-10);

  useEffect(() => {
    if (!publicKey) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/portfolio/${publicKey.toBase58()}`, { cache: "no-store" })
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
        if (!cancelled) setError("Couldn't load your holdings just now. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

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
    <div className="flex flex-1 flex-col bg-bg-primary text-text-primary">
      <header className="border-b border-border px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm text-text-secondary hover:text-solana-purple">
            ← GapGuard
          </Link>
          <h1 className="text-lg font-semibold">Your risk</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        <div className="border border-border bg-bg-card p-6 text-center sm:p-8">
          <p className="mb-4 text-text-secondary">
            Connect your wallet to see the tokenized stocks you hold, and
            what would happen to them if the price suddenly jumped.
          </p>
          <div className="flex justify-center">
            <WalletMultiButton />
          </div>
        </div>

        {connected && loading && (
          <p className="mt-8 text-center text-sm text-text-muted">Loading your holdings…</p>
        )}

        {connected && error && (
          <div className="mt-8 border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {connected && !loading && !error && data && data.holdings.length === 0 && (
          <div className="mt-8 text-center text-sm text-text-muted">
            <p>
              This wallet doesn&apos;t hold any of the tokens GapGuard tracks
              right now: the 8 tokenized stocks (Apple, Alphabet, Robinhood,
              MicroStrategy, Nvidia, QQQ, SPY, Tesla) or the 8 PreStocks
              pre-IPO tokens (OpenAI, Anthropic, SpaceX, Anduril and more).
            </p>
            {IS_DEVNET && (
              <p className="mx-auto mt-3 max-w-md border border-dashed border-border p-3 text-xs">
                This page always reads real holdings on Solana&apos;s main
                network — that part isn&apos;t a test. The Gap Insurance
                devnet test wallet (used for the free test pool on the{" "}
                <Link href="/protect" className="underline hover:text-solana-purple">
                  Protect
                </Link>{" "}
                page) is a separate, devnet-only address and has never held
                real stock tokens, so it&apos;s expected to show empty here.
                To see this page populated, connect a wallet that actually
                holds one of the tracked tokens on mainnet.
              </p>
            )}
          </div>
        )}

        {connected && !loading && !error && data && data.holdings.length > 0 && (
          <>
            <div className="mt-8 overflow-x-auto border border-border">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-bg-elevated text-left text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Value now</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => (
                    <tr key={h.mint} className="border-t border-border">
                      <td className="px-4 py-3">
                        <span className="font-medium">{h.ticker}</span>
                        <div className="text-xs text-text-muted">
                          {h.name}
                          {h.kind === "pre-ipo" && (
                            <span className="ml-2 border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                              Pre-IPO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {h.amountTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">{formatUsd(h.valueUsd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="px-4 py-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatUsd(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-8 border border-border p-5 sm:p-6">
              <label className="block text-sm text-text-secondary">
                If every stock you hold suddenly moved by {gapPct > 0 ? "+" : ""}
                {gapPct}%, here&apos;s what would happen:
              </label>
              <input
                type="range"
                min={-20}
                max={20}
                value={gapPct}
                onChange={(e) => setGapPct(Number(e.target.value))}
                className="mt-3 w-full accent-solana-purple"
              />

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="bg-bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-text-muted">
                    Your holdings would be worth
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                    {formatUsd(projectedValue)}
                  </p>
                  <p
                    className={`mt-1 font-mono text-sm tabular-nums ${
                      projectedChange < 0 ? "text-red-400" : "text-solana-green"
                    }`}
                  >
                    {projectedChange >= 0 ? "+" : ""}
                    {formatUsd(projectedChange)}
                  </p>
                </div>

                <div className="bg-bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-text-muted">
                    Kamino loan safety
                  </p>
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
                          projectedLtv >= data.obligation.liquidationLtv
                            ? "text-red-400"
                            : "text-solana-green"
                        }`}
                      >
                        {projectedLtv >= data.obligation.liquidationLtv
                          ? "This would trigger a liquidation."
                          : "Safe at this level."}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-text-muted">
                      You don&apos;t have a loan against these stocks on
                      Kamino, so there&apos;s no liquidation risk to show.
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
