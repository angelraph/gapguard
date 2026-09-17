/**
 * Devnet dry run of scripts/create-dbc-pool.ts's logic — same config, same
 * curve, but against devnet with a mock USDC mint (see create-mock-usdc.js)
 * so nothing here touches real money. This is the Day 6/7 validation the
 * plan calls for: prove the pool-creation code actually works before ever
 * pointing it at mainnet.
 */
const {
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
} = require("@meteora-ag/dynamic-bonding-curve-sdk");
const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  const secret = JSON.parse(
    fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8")
  );
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

  const { mint: mockUsdcMint } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "mock-usdc.json"), "utf-8")
  );

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

  console.log("Standing up Gap Insurance DBC pool for TSLA (devnet test)");
  console.log("Payer:", payer.publicKey.toBase58());
  console.log("Config:", configKeypair.publicKey.toBase58());
  console.log("Protection token mint:", baseMintKeypair.publicKey.toBase58());
  console.log("Quote mint (mock USDC):", mockUsdcMint);

  const curveConfig = buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.SIX,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 100,
          endingFeeBps: 100,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    // Must sum to 100, and the protocol requires at least 10% permanently
    // locked at day 1 (an anti-rug-pull rule enforced regardless of
    // whether migration ever actually happens) — confirmed by testing.
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 10,
      creatorLiquidityPercentage: 90,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    // Market-cap-based curve instead of buildCurve()'s raw
    // migrationQuoteThreshold: that raw number gets scaled internally in
    // an undocumented way tied to totalTokenSupply, and two different
    // "very high" values both threw "Not enough liquidity" trying to
    // guess it. initialMarketCap/migrationMarketCap are self-consistent
    // by construction — the SDK derives the curve from them directly.
    initialMarketCap: 1_000, // $1,000 starting valuation for 1,000,000 tokens
    migrationMarketCap: 1_000_000, // $1M — a 1000x ratio; still nowhere
    // near reachable by a single demo market's premium volume, and a much
    // less extreme ratio than 50,000x, which the curve math couldn't
    // represent (confirmed by testing).
  });

  const tx = await client.partner.createConfigAndPool({
    payer: payer.publicKey,
    config: configKeypair.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: new PublicKey(mockUsdcMint),
    preCreatePoolParam: {
      // Metaplex token metadata caps `name` at 32 bytes — confirmed by
      // testing (33 chars failed with "Name too long").
      name: "TSLA Gap Protection (devnet)",
      symbol: "TSLAGAP",
      uri: "",
      poolCreator: payer.publicKey,
      baseMint: baseMintKeypair.publicKey,
    },
    ...curveConfig,
  });

  const signature = await sendAndConfirmTransaction(connection, tx, [
    payer,
    configKeypair,
    baseMintKeypair,
  ]);

  console.log("Pool created:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  fs.writeFileSync(
    path.join(__dirname, "pool.json"),
    JSON.stringify(
      {
        pool: null, // filled in by deriving from config+baseMint if needed
        config: configKeypair.publicKey.toBase58(),
        baseMint: baseMintKeypair.publicKey.toBase58(),
        quoteMint: mockUsdcMint,
        signature,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
