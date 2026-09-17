/**
 * One-off script: stand up the single demo Gap Insurance DBC pool.
 *
 * Run with: npx tsx scripts/create-dbc-pool.ts
 *
 * Verified on 2026-09-16 against the INSTALLED
 * `@meteora-ag/dynamic-bonding-curve-sdk` types
 * (node_modules/@meteora-ag/dynamic-bonding-curve-sdk/dist/index.d.ts) —
 * this is meaningfully different from the SDK's own docs.md prose, which
 * undersells how structured `buildCurve`'s params are. Specifically:
 *  - `DynamicBondingCurveClient` takes a classic `@solana/web3.js`
 *    `Connection` (unlike klend-sdk, which needs `@solana/kit`'s `Rpc` —
 *    see lib/kamino/client.ts for that split).
 *  - To control `migrationQuoteThreshold` directly (so it's set
 *    unreachably high and the pool never graduates mid-demo), use
 *    `buildCurve()` — NOT `buildCurveWithMarketCap()`, which computes the
 *    threshold from a market-cap target instead of taking it directly.
 *  - `MigrationConfig` has no plain "disable migration" flag; the actual
 *    lever is `migrationQuoteThreshold` being unreachable, combined with
 *    `MigrationOption.MET_DAMM_V2` (required — `MET_DAMM` is deprecated
 *    for new configs) and a `MigrationFeeOption` (arbitrary since it's
 *    never reached).
 *
 * ⚠️ STILL UNVERIFIED: the exact account list `createConfigAndPool` needs
 * beyond `payer`/`config`/`quoteMint`/`feeClaimer`/`leftoverReceiver`
 * (confirmed present in the type file) — e.g. whether `tokenBadge` is
 * required for USDC specifically. Run this against devnet first
 * (`SOLANA_RPC_URL` pointed at a devnet endpoint) and fix compile/runtime
 * errors before touching mainnet — this is exactly the day-1/day-6 dry run
 * called for in docs/submission.md, not a script to trust blind.
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
  buildCurve,
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

  const curveConfig = buildCurve({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.SIX, // USDC has 6 decimals.
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000, // 1,000,000 protection tokens total supply.
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
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    percentageSupplyOnMigration: 1, // minimal — migration should never
    // actually trigger given the threshold below, but the field is required.
    migrationQuoteThreshold: DBC_CONFIG_PARAMS.migrationQuoteThreshold,
  });

  const tx = await client.partner.createConfigAndPool({
    payer: payer.publicKey,
    config: configKeypair.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: USDC_MINT,
    preCreatePoolParam: {
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
