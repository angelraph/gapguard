import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  DynamicBondingCurveClient,
  getCurrentPoint,
  type VirtualPool,
  type PoolConfig,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

/**
 * Reads and quotes against a live Gap Insurance DBC pool. Everything here
 * is a plain read (or, for `buildBuyTransaction`, an unsigned transaction
 * the caller's own wallet has to sign) — no server-held funds involved.
 *
 * Field names below (`pool.poolState.config`, `quote.outputAmount`) were
 * confirmed by reading the installed SDK's own compiled implementation
 * (dist/index.js), not just its .d.ts — the .d.ts alone doesn't show that
 * `VirtualPool`'s real fields live under a nested `poolState`, or that the
 * quote result's amount field is `outputAmount` rather than `amountOut`.
 *
 * ⚠️ Not yet exercised against a real pool: scripts/create-dbc-pool.ts
 * hasn't been run (deploying a pool means funding a wallet with real SOL
 * and USDC, a financial decision for the project owner to make, not
 * something to do automatically). Once a pool exists, sanity-check a
 * quote here against what the Meteora app itself shows for the same pool
 * before trusting this in front of real users.
 */

export type PoolState = {
  pool: VirtualPool;
  config: PoolConfig;
};

export async function fetchPoolState(
  connection: Connection,
  poolAddress: string
): Promise<PoolState> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const pool = await client.state.getPool(new PublicKey(poolAddress));
  if (!pool) throw new Error(`No pool found at ${poolAddress}`);
  const config = await client.state.getPoolConfig(pool.poolState.config);
  if (!config) throw new Error(`No config found for pool ${poolAddress}`);
  return { pool, config };
}

export type BuyQuote = {
  /** Protection tokens the buyer would receive. */
  amountOut: BN;
  /** Same amount, as a plain number, for display. */
  amountOutDisplay: number;
};

const DEFAULT_SLIPPAGE_BPS = 100; // 1% — protection tokens aren't meant to
// be a volatile trade, so a tight default slippage is appropriate.

export async function getBuyQuote(
  connection: Connection,
  poolAddress: string,
  usdcAmountIn: BN,
  /** Decimals of the PROTECTION token being bought (the output), not
   * USDC's — set via TokenDecimal in scripts/create-dbc-pool.ts. */
  protectionTokenDecimals = 6
): Promise<BuyQuote> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const { pool, config } = await fetchPoolState(connection, poolAddress);
  const currentPoint = await getCurrentPoint(connection, config.activationType);

  const quote = client.pool.swapQuote({
    virtualPool: pool,
    config,
    swapBaseForQuote: false, // buying the base (protection) token with quote (USDC)
    amountIn: usdcAmountIn,
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
  });

  return {
    amountOut: quote.outputAmount,
    amountOutDisplay: quote.outputAmount.toNumber() / 10 ** protectionTokenDecimals,
  };
}

/** Builds the unsigned buy transaction. The caller's wallet must sign and
 * send it — this function never holds or moves funds on its own. */
export async function buildBuyTransaction(
  connection: Connection,
  poolAddress: string,
  buyer: PublicKey,
  usdcAmountIn: BN,
  minimumAmountOut: BN
) {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  return client.pool.swap({
    owner: buyer,
    pool: new PublicKey(poolAddress),
    amountIn: usdcAmountIn,
    minimumAmountOut,
    swapBaseForQuote: false,
    referralTokenAccount: null,
  });
}
