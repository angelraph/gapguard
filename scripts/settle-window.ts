/**
 * The scripted settlement trigger for the Gap Insurance demo market.
 *
 * Run with: npx tsx scripts/settle-window.ts
 *
 * This is deliberately a human-run script, not a permissionless on-chain
 * crank — see docs/submission.md for why that's an honest, stated design
 * choice for a 9-day build rather than a hidden shortcut.
 *
 * What it does:
 *   1. Fetch Pyth's current equity price for PROTECTION_MARKET.ticker
 *      (the "reopen" price — run this once markets reopen after the
 *      window in dbcPool.ts).
 *   2. Compare against the recorded "close" price (captured separately at
 *      Friday's close — persist that snapshot before running this).
 *   3. Compute the settlement result via computeSettlement().
 *   4. Write the result on-chain via the Memo program
 *      (recordSettlementOnChain) so it's independently verifiable.
 *   5. Print payout-per-token so the redemption flow can use it.
 */

import { Connection, Keypair } from "@solana/web3.js";
import { fetchLatestPrices, toDecimal } from "../lib/pyth/client";
import { PYTH_FEED_IDS } from "../lib/pyth/feedIds";
import { PROTECTION_MARKET } from "../lib/meteora/dbcPool";
import { computeSettlement, recordSettlementOnChain } from "../lib/meteora/settlement";

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const treasurySecret = process.env.TREASURY_KEYPAIR_SECRET;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL is not set in .env.local");
  if (!treasurySecret)
    throw new Error("TREASURY_KEYPAIR_SECRET is not set in .env.local");

  // TODO: replace with the actual close price snapshot taken at Friday's
  // close (persist it in day-6/day-7 work rather than hardcoding here).
  const CLOSE_PRICE_SNAPSHOT = Number(process.argv[2]);
  if (!CLOSE_PRICE_SNAPSHOT) {
    throw new Error(
      "Usage: npx tsx scripts/settle-window.ts <closePriceSnapshot>"
    );
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const feeds = PYTH_FEED_IDS[PROTECTION_MARKET.ticker];

  const prices = await fetchLatestPrices([feeds.equity]);
  const equity = prices.find((p) => p.id === feeds.equity);
  if (!equity) throw new Error("Could not fetch reopen price from Pyth");

  const reopenPrice = toDecimal(equity.price.price, equity.price.expo);

  // TODO: read actual pool USDC balance and outstanding protection-token
  // supply from chain once scripts/create-dbc-pool.ts is wired up.
  const POOL_USDC_BALANCE = 0;
  const OUTSTANDING_TOKENS = 0;

  const result = computeSettlement(
    CLOSE_PRICE_SNAPSHOT,
    reopenPrice,
    POOL_USDC_BALANCE,
    OUTSTANDING_TOKENS
  );

  console.log("Settlement result:", result);

  const treasury = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(treasurySecret))
  );
  const signature = await recordSettlementOnChain(connection, treasury, result);
  console.log(`Recorded on-chain: https://explorer.solana.com/tx/${signature}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
