"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BN from "bn.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from "@solana/spl-token";
import { getBuyQuote, buildBuyTransaction, getProtectionMint } from "@/lib/meteora/quote";
import type { SettlementResult } from "@/lib/meteora/settlement";
import { NETWORKS, useNetwork } from "@/lib/network";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Gap Insurance (layer 3): a real buy flow against the Meteora DBC SDK,
 * on whichever network the visitor picks (mainnet with real money, or
 * devnet, a free test network with a free faucet). If a network has no
 * pool configured yet, this page says so instead of pretending to work.
 */
const USDC_DECIMALS = 6;

/** Wallets and wallet-adapter throw raw, often opaque messages ("Unexpected
 * error", "0x1", etc.) — translate the common ones into something a person
 * can actually act on, instead of showing that raw text. */
function friendlyBuyError(err: unknown, IS_DEVNET: boolean): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("reject")) {
    return "You declined the transaction in your wallet — nothing was sent.";
  }
  if (lower.includes("not been authorized")) {
    return IS_DEVNET
      ? "Your wallet is set to Mainnet, but you picked the Devnet test pool. Switch your wallet's network to Devnet (in Phantom: Settings → Developer Settings → Change Network), or pick Mainnet above, then try again."
      : "Your wallet refused this request. If it's set to Devnet, switch it to Mainnet (Phantom: Settings → Developer Settings), make sure it's unlocked, and try again.";
  }
  if (
    lower.includes("insufficient") ||
    lower.includes("0x1") ||
    lower.includes("unexpected error")
  ) {
    return IS_DEVNET
      ? "Your wallet doesn't have the devnet SOL or the test USDC this pool needs. Use the free test USDC button on this page, and get a little devnet SOL from faucet.solana.com."
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
  const { config, setNetwork } = useNetwork();
  const POOL_ADDRESS = config.pool;
  const IS_DEVNET = config.isDevnet;
  const PROTECTION_MARKET = config.market;

  const [usdcAmount, setUsdcAmount] = useState(10);
  const [quoteTokens, setQuoteTokens] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [buyStatus, setBuyStatus] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [faucetStatus, setFaucetStatus] = useState<string | null>(null);
  const [protectionBalance, setProtectionBalance] = useState<number | null>(null);
  const PROTECTION_DECIMALS = 6;

  async function refreshProtectionBalance() {
    if (!POOL_ADDRESS || !publicKey) {
      setProtectionBalance(null);
      return;
    }
    try {
      const mint = await getProtectionMint(connection, POOL_ADDRESS);
      const ata = await getAssociatedTokenAddress(mint, publicKey);
      const account = await getAccount(connection, ata);
      setProtectionBalance(Number(account.amount) / 10 ** PROTECTION_DECIMALS);
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        setProtectionBalance(0);
      } else {
        setProtectionBalance(null);
      }
    }
  }

  useEffect(() => {
    setProtectionBalance(null);
    setTxSignature(null);
    setBuyError(null);
    refreshProtectionBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, connection, POOL_ADDRESS]);

  useEffect(() => {
    setSettlement(null);
    fetch(`/api/protect/settlement?network=${config.id}`)
      .then((res) => res.json())
      .then((json) => setSettlement(json.settlement ?? null))
      .catch(() => setSettlement(null));
  }, [config.id]);

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
  }, [connection, usdcAmount, POOL_ADDRESS]);

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
      refreshProtectionBalance();
    } catch (err) {
      setBuyError(friendlyBuyError(err, IS_DEVNET));
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
    <div className="flex flex-1 flex-col text-text-primary">
      <SiteHeader active="insurance" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4 sm:px-10">
        <p className="eyebrow">Gap Insurance</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          Insure one weekend against <span className="text-gradient">a big price jump</span>
        </h1>
        <p className="mb-6 mt-4 max-w-xl text-text-secondary">
          Pay a small fee now to protect one stock over one weekend. If its
          price jumps too much, you get paid back.
        </p>

        <div
          role="tablist"
          aria-label="Network"
          className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-bg-elevated p-1 text-sm"
        >
          {(["mainnet", "devnet"] as const).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={config.id === id}
              onClick={() => setNetwork(id)}
              className={`rounded-full px-3 py-2.5 font-medium transition-colors ${
                config.id === id
                  ? "bg-brand text-on-brand"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {NETWORKS[id].label}
            </button>
          ))}
        </div>

        {IS_DEVNET ? (
          <div className="mb-4 border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            <p>
              You&apos;re on Solana&apos;s devnet, a free test network. No
              real money is involved, and the test USDC here has no real
              value. It exists so anyone can try the full flow at no cost.
            </p>
            <p className="mt-2">
              Before you connect: set your wallet&apos;s active network to
              Devnet. No website can do this for you — it&apos;s a setting
              inside your wallet, on purpose, for your safety. In Phantom:
              Settings → Developer Settings → Change Network → Devnet.
            </p>
          </div>
        ) : (
          <div className="mb-4 border border-border bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
            <p>
              You&apos;re on Solana mainnet, so this uses real USDC. Buy only
              what you&apos;re happy to risk: this is a hackathon project,
              not audited financial infrastructure. Want to try it for free
              first? Pick Devnet above.
            </p>
            <p className="mt-2">
              Make sure your wallet&apos;s network is set to Mainnet before
              you connect.
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
            checked against Pyth&apos;s real stock price feed, and the exact
            prices are written on-chain, so nobody (including us) can fake
            the result.
          </p>

          {!POOL_ADDRESS && (
            <div className="mt-6 border border-dashed border-border p-4 text-sm text-text-muted">
              There&apos;s no protection pool on {config.isDevnet ? "devnet" : "mainnet"}{" "}
              yet. Try the {config.isDevnet ? "mainnet" : "devnet"} tab above.
            </div>
          )}

          {POOL_ADDRESS && windowIsOpen && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>

              {connected && protectionBalance !== null && (
                <div className="border border-border bg-bg-elevated p-3 text-center text-sm">
                  <span className="text-text-secondary">You currently hold </span>
                  <span className="font-mono font-semibold text-mint">
                    {protectionBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-text-secondary">
                    {" "}
                    protection token{protectionBalance === 1 ? "" : "s"} for this window.
                  </span>
                  {protectionBalance === 0 && (
                    <p className="mt-1 text-xs text-text-muted">
                      This updates the moment a buy confirms — no need to check
                      your wallet&apos;s own token list separately.
                    </p>
                  )}
                </div>
              )}

              {IS_DEVNET && connected && (
                <div className="border border-dashed border-border p-3 text-center">
                  <button
                    onClick={handleGetTestUsdc}
                    disabled={!!faucetStatus && faucetStatus.startsWith("Sending")}
                    className="text-sm text-brand underline hover:text-brand/80 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!connected ? "Connect your wallet first" : buyStatus ?? "Buy protection"}
              </button>

              {buyError && (
                <p className="text-sm text-red-400">{buyError}</p>
              )}

              {txSignature && (
                <p className="text-sm text-mint">
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
                Checked against {settlement.priceSource ?? "real price data"}:
                {" "}$
                {settlement.closePrice.toFixed(2)} at close, $
                {settlement.reopenPrice.toFixed(2)} at reopen. The exact
                Pyth timestamps are recorded on-chain so anyone can re-check
                this.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
