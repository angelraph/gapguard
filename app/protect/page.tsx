"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BN from "bn.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PROTECTION_MARKET } from "@/lib/meteora/dbcPool";
import { getBuyQuote, buildBuyTransaction } from "@/lib/meteora/quote";
import type { SettlementResult } from "@/lib/meteora/settlement";

/**
 * Gap Insurance (layer 3). The buy flow below is real, working code
 * against the Meteora DBC SDK — but it can only do anything once a pool
 * actually exists on-chain, which needs scripts/create-dbc-pool.ts to be
 * run by someone funding a wallet with real SOL and USDC. That's a
 * financial decision for the project owner, not something done
 * automatically. Until NEXT_PUBLIC_PROTECTION_POOL is set, this page
 * honestly says so instead of pretending to work.
 */
const POOL_ADDRESS = process.env.NEXT_PUBLIC_PROTECTION_POOL;
const USDC_DECIMALS = 6;

export default function ProtectPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [usdcAmount, setUsdcAmount] = useState(10);
  const [quoteTokens, setQuoteTokens] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [buyStatus, setBuyStatus] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);

  useEffect(() => {
    fetch("/api/protect/settlement")
      .then((res) => res.json())
      .then((json) => setSettlement(json.settlement ?? null))
      .catch(() => setSettlement(null));
  }, []);

  useEffect(() => {
    if (!POOL_ADDRESS || usdcAmount <= 0) {
      setQuoteTokens(null);
      return;
    }
    let cancelled = false;
    const usdcLamports = new BN(Math.round(usdcAmount * 10 ** USDC_DECIMALS));

    getBuyQuote(connection, POOL_ADDRESS, usdcLamports)
      .then((q) => {
        if (!cancelled) {
          setQuoteTokens(q.amountOutDisplay);
          setQuoteError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuoteTokens(null);
          setQuoteError(err instanceof Error ? err.message : "Couldn't get a quote.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connection, usdcAmount]);

  async function handleBuy() {
    if (!POOL_ADDRESS || !publicKey) return;
    setBuyError(null);
    setTxSignature(null);
    setBuyStatus("Getting a fresh quote…");

    try {
      const usdcLamports = new BN(Math.round(usdcAmount * 10 ** USDC_DECIMALS));
      const q = await getBuyQuote(connection, POOL_ADDRESS, usdcLamports);
      const minimumAmountOut = q.amountOut.muln(99).divn(100); // 1% slippage floor

      setBuyStatus("Building the transaction…");
      const tx = await buildBuyTransaction(
        connection,
        POOL_ADDRESS,
        publicKey,
        usdcLamports,
        minimumAmountOut
      );

      setBuyStatus("Waiting for you to approve in your wallet…");
      const signature = await sendTransaction(tx, connection);

      setBuyStatus("Confirming on-chain…");
      await connection.confirmTransaction(signature, "confirmed");

      setTxSignature(signature);
      setBuyStatus(null);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Something went wrong buying protection.");
      setBuyStatus(null);
    }
  }

  const windowIsOpen = !settlement;

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-50">
            ← GapGuard
          </Link>
          <h1 className="text-lg font-semibold">Gap Insurance</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        <p className="mb-6 text-sm text-zinc-400">
          Pay a small fee now to protect one stock over one weekend. If its
          price jumps too much, you get paid back.
        </p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">{PROTECTION_MARKET.ticker}</h2>
          <p className="mt-1 text-zinc-400">{PROTECTION_MARKET.windowLabel}</p>
          <p className="mt-4 text-sm text-zinc-400">
            You get paid back if {PROTECTION_MARKET.ticker}&apos;s price
            moves more than {(PROTECTION_MARKET.gapThresholdBps / 100).toFixed(1)}%
            between Friday&apos;s close and Monday&apos;s open. This is
            checked against real price data, so nobody (including us) can
            fake the result.
          </p>

          {!POOL_ADDRESS && (
            <div className="mt-6 rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
              This market isn&apos;t open yet — no protection pool has been
              created on-chain. Buying and getting paid back will work here
              the moment one exists.
            </div>
          )}

          {POOL_ADDRESS && windowIsOpen && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>

              <div>
                <label className="block text-sm text-zinc-400">
                  How much do you want to pay for protection? (USDC)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={usdcAmount}
                  onChange={(e) => setUsdcAmount(Number(e.target.value))}
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="text-sm text-zinc-400">
                {quoteError
                  ? quoteError
                  : quoteTokens !== null
                  ? `You'd receive about ${quoteTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} protection tokens.`
                  : "Getting a quote…"}
              </div>

              <button
                onClick={handleBuy}
                disabled={!connected || !quoteTokens || !!buyStatus}
                className="w-full rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!connected ? "Connect your wallet first" : buyStatus ?? "Buy protection"}
              </button>

              {buyError && (
                <p className="text-sm text-red-400">{buyError}</p>
              )}

              {txSignature && (
                <p className="text-sm text-emerald-400">
                  Done!{" "}
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View the transaction
                  </a>
                </p>
              )}
            </div>
          )}

          {POOL_ADDRESS && settlement && (
            <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
              <p className="text-sm font-medium">
                This window has settled: {PROTECTION_MARKET.ticker} moved{" "}
                {settlement.gapBps / 100}% by the time the market reopened.
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {settlement.triggered
                  ? `Protection paid out. Each protection token is worth $${settlement.payoutPerTokenUsd.toFixed(4)}.`
                  : "The move wasn't big enough to trigger a payout."}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Checked against real price data at settlement time: $
                {settlement.closePrice.toFixed(2)} at close, $
                {settlement.reopenPrice.toFixed(2)} at reopen.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
