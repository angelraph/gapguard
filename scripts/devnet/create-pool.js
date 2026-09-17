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
  buildCurve,
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

  const curveConfig = buildCurve({
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
    percentageSupplyOnMigration: 1,
    migrationQuoteThreshold: 1_000_000_000_000, // effectively unreachable
  });

  const tx = await client.partner.createConfigAndPool({
    payer: payer.publicKey,
    config: configKeypair.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: new PublicKey(mockUsdcMint),
    preCreatePoolParam: {
      name: "TSLA Gap Protection (devnet test)",
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
