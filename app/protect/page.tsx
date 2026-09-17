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
const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "mainnet-beta";
const IS_DEVNET = NETWORK === "devnet";
const USDC_DECIMALS = 6;

/** Wallets and wallet-adapter throw raw, often opaque messages ("Unexpected
 * error", "0x1", etc.) — translate the common ones into something a person
 * can actually act on, instead of showing that raw text. */
function friendlyBuyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("reject")) {
    return "You declined the transaction in your wallet — nothing was sent.";
  }
  if (lower.includes("not been authorized")) {
    return IS_DEVNET
      ? "Your wallet is set to Mainnet, but this test pool lives on Devnet. Switch your wallet's network to Devnet (in Phantom: Settings → Developer Settings → Change Network), then try again."
      : "Your wallet refused this request. Make sure it's unlocked and try again.";
  }
  if (
    lower.includes("insufficient") ||
    lower.includes("0x1") ||
    lower.includes("unexpected error")
  ) {
    return IS_DEVNET
      ? "Your wallet doesn't have the devnet SOL or the test token this pool needs. This is a devnet test pool — only a small set of test wallets currently hold the token it trades against. Ask for test funds and try again."
      : "Your wallet doesn't have enough SOL or USDC to complete this purchase.";
  }
  if (lower.includes("token account") || lower.includes("could not find account")) {
    return "Your wallet doesn't hold the token this pool needs yet, so there's nothing to swap from.";
  }

  return `Something went wrong buying protection (${raw}).`;
}

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
  const [faucetStatus, setFaucetStatus] = useState<string | null>(null);

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
      setBuyError(friendlyBuyError(err));
      setBuyStatus(null);
    }
  }

  const windowIsOpen = !settlement;
  const explorerUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}${IS_DEVNET ? "?cluster=devnet" : ""}`;
  const solscanUrl = (sig: string) =>
    `https://solscan.io/tx/${sig}${IS_DEVNET ? "?cluster=devnet" : ""}`;

  async function handleGetTestUsdc() {
    if (!publicKey) return;
    setFaucetStatus("Sending you 50 test USDC…");
    try {
      const res = await fetch("/api/devnet-faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setFaucetStatus(`Sent! ${json.amount} test USDC is in your wallet now.`);
    } catch (err) {
      setFaucetStatus(
        err instanceof Error ? err.message : "Couldn't send test USDC right now."
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-bg-primary text-text-primary">
      <header className="border-b border-border px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm text-text-secondary hover:text-solana-purple">
            ← GapGuard
          </Link>
          <h1 className="text-lg font-semibold">Gap Insurance</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        <p className="mb-6 text-sm text-text-secondary">
          Pay a small fee now to protect one stock over one weekend. If its
          price jumps too much, you get paid back.
        </p>

        {POOL_ADDRESS && IS_DEVNET && (
          <div className="mb-4 border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>
              This pool runs on Solana&apos;s devnet — a free test network.
              No real money is involved, and any tokens used here have no
              real value. This exists to prove the mechanism works before a
              real, mainnet pool is funded.
            </p>
            <p className="mt-2">
              Before you connect: set your wallet&apos;s active network to
              Devnet. No website can do this for you — it&apos;s a setting
              inside your wallet, on purpose, for your safety. In Phantom:
              Settings → Developer Settings → Change Network → Devnet.
            </p>
          </div>
        )}

        <div className="border border-border bg-bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">{PROTECTION_MARKET.ticker}</h2>
          <p className="mt-1 text-text-secondary">{PROTECTION_MARKET.windowLabel}</p>
          <p className="mt-4 text-sm text-text-secondary">
            You get paid back if {PROTECTION_MARKET.ticker}&apos;s price
            moves more than {(PROTECTION_MARKET.gapThresholdBps / 100).toFixed(1)}%
            between Friday&apos;s close and Monday&apos;s open. This is
            checked against real price data, so nobody (including us) can
            fake the result.
          </p>

          {!POOL_ADDRESS && (
            <div className="mt-6 border border-dashed border-border p-4 text-sm text-text-muted">
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

              {IS_DEVNET && connected && (
                <div className="border border-dashed border-border p-3 text-center">
                  <button
                    onClick={handleGetTestUsdc}
                    disabled={!!faucetStatus && faucetStatus.startsWith("Sending")}
                    className="text-sm text-solana-purple underline hover:text-solana-purple/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Get 50 test USDC for this wallet
                  </button>
                  {faucetStatus && (
                    <p className="mt-1 text-xs text-text-muted">{faucetStatus}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-text-secondary">
                  How much do you want to pay for protection? (USDC)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={usdcAmount}
                  onChange={(e) => setUsdcAmount(Number(e.target.value))}
                  className="mt-2 w-full border border-border bg-bg-elevated px-3 py-2 font-mono text-sm"
                />
              </div>

              <div className="text-sm text-text-secondary">
                {quoteError
                  ? quoteError
                  : quoteTokens !== null
                  ? `You'd receive about ${quoteTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} protection tokens.`
                  : "Getting a quote…"}
              </div>

              <button
                onClick={handleBuy}
                disabled={!connected || !quoteTokens || !!buyStatus}
                className="w-full bg-solana-purple px-4 py-2 text-sm font-medium text-white hover:bg-solana-purple/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!connected ? "Connect your wallet first" : buyStatus ?? "Buy protection"}
              </button>

              {buyError && (
                <p className="text-sm text-red-400">{buyError}</p>
              )}

              {txSignature && (
                <p className="text-sm text-solana-green">
                  Done!{" "}
                  <a
                    href={explorerUrl(txSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View on Explorer
                  </a>
                  {" "}or{" "}
                  <a
                    href={solscanUrl(txSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Solscan
                  </a>
                  {IS_DEVNET && (
                    <span className="mt-1 block text-xs text-text-muted">
                      If Explorer says the browser check failed or the
                      transaction isn&apos;t found, try Solscan instead, or
                      wait a few seconds and reload — both are the
                      indexer catching up, not a failed transaction.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {POOL_ADDRESS && settlement && (
            <div className="mt-6 border border-border bg-bg-elevated p-4">
              <p className="text-sm font-medium">
                This window has settled: {PROTECTION_MARKET.ticker} moved{" "}
                {settlement.gapBps / 100}% by the time the market reopened.
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {settlement.triggered
                  ? `Protection paid out. Each protection token is worth $${settlement.payoutPerTokenUsd.toFixed(4)}.`
                  : "The move wasn't big enough to trigger a payout."}
              </p>
              <p className="mt-2 font-mono text-xs text-text-muted">
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
