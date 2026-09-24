import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchToken2022Balances, xStockHoldingsFrom } from "@/lib/solana/holdings";
import { fetchPreStocks } from "@/lib/prestocks/client";
import { fetchObligationSummary } from "@/lib/kamino/portfolio";
import { getMarketData } from "@/lib/marketData";

export type PortfolioHolding = {
  /** "stock" = a tokenized public stock, "pre-ipo" = a PreStocks token. */
  kind: "stock" | "pre-ipo";
  ticker: string;
  name: string;
  xstockSymbol: string;
  mint: string;
  amountTokens: number;
  currentPrice: number;
  valueUsd: number;
  /** Same "how far the token has drifted from the real stock price" figure
   * the Radar shows, so a jump risk is visible per holding, not just in
   * the abstract. */
  basis: number;
};

/**
 * GET /api/portfolio/[wallet]
 *
 * Returns a wallet's tokenized-stock holdings, valued at the current live
 * price, plus its Kamino lending position if it has one. Everything here
 * is a free, permissionless read — no paid API, no signup, works for any
 * wallet address without that wallet needing to do anything first.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await params;

  let walletPubkey: PublicKey;
  try {
    walletPubkey = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid Solana wallet address." }, { status: 400 });
  }

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return NextResponse.json({ error: "SOLANA_RPC_URL is not configured." }, { status: 500 });
  }

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const [balances, { source, stocks }, preStocks] = await Promise.all([
      fetchToken2022Balances(connection, walletPubkey),
      getMarketData(),
      fetchPreStocks().catch(() => []),
    ]);

    const priceByTicker = new Map(stocks.map((s) => [s.ticker, s]));
    const stockHoldings = xStockHoldingsFrom(balances)
      .map((h): PortfolioHolding | null => {
        const live = priceByTicker.get(h.ticker);
        if (!live) return null;
        return {
          kind: "stock",
          ticker: h.ticker,
          name: h.name,
          xstockSymbol: h.xstockSymbol,
          mint: h.mint,
          amountTokens: h.amountTokens,
          currentPrice: live.xstockPrice,
          valueUsd: h.amountTokens * live.xstockPrice,
          basis: live.basis,
        };
      })
      .filter((h): h is PortfolioHolding => h !== null);

    // Pre-IPO tokens: the "basis" is the on-chain price vs the issuer's mark.
    const preIpoHoldings: PortfolioHolding[] = preStocks
      .filter((p) => balances.has(p.mint))
      .map((p): PortfolioHolding => {
        const amountTokens = balances.get(p.mint)!;
        return {
          kind: "pre-ipo",
          ticker: p.symbol,
          name: p.company,
          xstockSymbol: p.symbol,
          mint: p.mint,
          amountTokens,
          currentPrice: p.tokenPrice,
          valueUsd: amountTokens * p.tokenPrice,
          basis: p.gap,
        };
      });

    const holdings = [...stockHoldings, ...preIpoHoldings];

    let obligation = null;
    try {
      obligation = await fetchObligationSummary(rpcUrl, wallet);
    } catch (obligationErr) {
      console.error("Kamino obligation fetch failed:", obligationErr);
    }

    return NextResponse.json({ source, holdings, obligation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
