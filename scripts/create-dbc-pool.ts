/**
 * One-off script: stand up the single demo Gap Insurance DBC pool.
 *
 * Run with: npx tsx scripts/create-dbc-pool.ts
 *
 * VERIFIED WORKING on devnet on 2026-09-17 (see scripts/devnet/create-pool.js,
 * which uses this exact same config) — not just type-checked. Real pool
 * created, real transaction confirmed. This mainnet version was updated to
 * match every fix found during that dry run:
 *  - `DynamicBondingCurveClient` takes a classic `@solana/web3.js`
 *    `Connection` (unlike klend-sdk, which needs `@solana/kit`'s `Rpc` —
 *    see lib/kamino/client.ts for that split).
 *  - `buildCurveWithMarketCap()`, not `buildCurve()` — the latter's raw
 *    `migrationQuoteThreshold` gets scaled internally in an undocumented
 *    way tied to `totalTokenSupply`; two different "very high" values
 *    both threw "Not enough liquidity" trying to guess it by hand.
 *    `initialMarketCap`/`migrationMarketCap` are self-consistent by
 *    construction. A 50,000x ratio between them also failed the same way
 *    — 1,000x (see lib/meteora/dbcPool.ts) works.
 *  - `liquidityDistribution` percentages must sum to 100, and the
 *    protocol requires at least 10% permanently locked at day 1 (an
 *    anti-rug-pull rule enforced regardless of whether migration ever
 *    actually happens) — neither documented in the SDK's types or docs.md.
 *  - Metaplex token metadata caps `name` at 32 bytes.
 *
 * ⚠️ STILL UNVERIFIED for a REAL USDC quote mint specifically: whether
 * `tokenBadge` is required (the devnet dry run used a plain, freshly
 * minted SPL token as the quote mint, not real USDC, which may have
 * different badge/permission requirements — check
 * https://docs.meteora.ag if this errors on mainnet with something
 * about a missing token badge).
 */

import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { DBC_CONFIG_PARAMS, PROTECTION_MARKET, USDC_MINT } from "../lib/meteora/dbcPool";

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL is not set in .env.local");

  const connection = new Connection(rpcUrl, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  // TODO: load a persistent treasury keypair instead of generating a fresh
  // one each run, once TREASURY_KEYPAIR_SECRET is wired up.
  const payer = Keypair.generate();
  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

  console.log(
    `Standing up Gap Insurance DBC pool for ${PROTECTION_MARKET.ticker}`
  );
  console.log(`Window: ${PROTECTION_MARKET.windowLabel}`);
  console.log(`Gap threshold: ${PROTECTION_MARKET.gapThresholdBps} bps`);
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Config: ${configKeypair.publicKey.toBase58()}`);
  console.log(`Protection token mint: ${baseMintKeypair.publicKey.toBase58()}`);

  const curveConfig = buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.SIX, // USDC has 6 decimals.
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: DBC_CONFIG_PARAMS.totalTokenSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 100, // 1% — a small, transparent sale fee; the
          // premium itself (not this fee) is the actual product.
          endingFeeBps: 100,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: DBC_CONFIG_PARAMS.collectFeeMode as CollectFeeMode,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: DBC_CONFIG_PARAMS.liquidityDistribution,
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: DBC_CONFIG_PARAMS.initialMarketCap,
    migrationMarketCap: DBC_CONFIG_PARAMS.migrationMarketCap,
  });

  const tx = await client.partner.createConfigAndPool({
    payer: payer.publicKey,
    config: configKeypair.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: USDC_MINT,
    preCreatePoolParam: {
      // Metaplex token metadata caps this at 32 bytes.
      name: `${PROTECTION_MARKET.ticker} Gap Protection`,
      symbol: `${PROTECTION_MARKET.ticker}GAP`,
      uri: "",
      poolCreator: payer.publicKey,
      baseMint: baseMintKeypair.publicKey,
    },
    ...curveConfig,
  } as Parameters<typeof client.partner.createConfigAndPool>[0]);

  const signature = await sendAndConfirmTransaction(connection, tx, [
    payer,
    configKeypair,
    baseMintKeypair,
  ]);

  console.log(`Pool created: https://explorer.solana.com/tx/${signature}`);
  console.log(
    "Persist configKeypair.publicKey and baseMintKeypair.publicKey now — app/protect and scripts/settle-window.ts need them."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
