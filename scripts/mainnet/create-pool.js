/**
 * Creates the real Gap Insurance pool on Solana MAINNET.
 *
 *   node scripts/mainnet/create-pool.js            checks everything, sends nothing
 *   node scripts/mainnet/create-pool.js --send     creates the pool (spends real SOL)
 *
 * Same config as the devnet pool that was tested end to end, with real USDC
 * as the quote token. Uses the dedicated wallet in scripts/mainnet/treasury.json
 * (git-ignored). Creation costs roughly 0.03 SOL in rent.
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

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const METADATA_URI = "https://gapguard-alpha.vercel.app/tsla-gap-protection.json";
const MIN_SOL = 0.05;

// Uses scripts/mainnet/treasury.key if it exists: a text file holding the
// private key exactly as Phantom exports it (one line, base58). The key
// never goes through chat or git. Otherwise falls back to treasury.json.
function loadPayer() {
  // pool-wallet.key wins if it exists, then treasury.key, then treasury.json.
  const keyFile = [path.join(__dirname, "pool-wallet.key"), path.join(__dirname, "treasury.key")].find((f) =>
    fs.existsSync(f)
  );
  if (keyFile) {
    const bs58 = require("bs58");
    const decode = (bs58.default || bs58).decode;
    const PLACEHOLDER = "PASTE_YOUR_PHANTOM_PRIVATE_KEY_HERE";
    // Tolerates the placeholder being left on the line next to the key.
    const text = fs.readFileSync(keyFile, "utf-8").replace(PLACEHOLDER, "").trim();
    if (!text) {
      throw new Error("scripts/mainnet/treasury.key still holds only the placeholder. Put your private key in it first.");
    }
    return Keypair.fromSecretKey(decode(text));
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8")))
  );
}

async function main() {
  const send = process.argv.includes("--send");
  const payer = loadPayer();
  const connection = new Connection(RPC, "confirmed");

  const sol = (await connection.getBalance(payer.publicKey)) / 1e9;
  console.log(`Wallet ${payer.publicKey.toBase58()} holds ${sol} SOL`);
  if (sol < MIN_SOL) {
    throw new Error(`Needs at least ${MIN_SOL} SOL to create the pool. Fund the wallet first.`);
  }

  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

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
        feeSchedulerParam: { startingFeeBps: 100, endingFeeBps: 100, numberOfPeriod: 0, totalDuration: 0 },
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
    initialMarketCap: 1_000,
    migrationMarketCap: 1_000_000,
  });

  const tx = await client.partner.createConfigAndPool({
    payer: payer.publicKey,
    config: configKeypair.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: USDC_MINT,
    preCreatePoolParam: {
      name: "TSLA Gap Protection", // Metaplex caps this at 32 bytes
      symbol: "TSLAGAP",
      uri: METADATA_URI,
      poolCreator: payer.publicKey,
      baseMint: baseMintKeypair.publicKey,
    },
    ...curveConfig,
  });

  tx.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const sim = await connection.simulateTransaction(tx, [payer, configKeypair, baseMintKeypair]);
  console.log("Simulation:", sim.value.err ? JSON.stringify(sim.value.err) : "OK");
  if (sim.value.err) {
    console.log((sim.value.logs || []).slice(-8).join("\n"));
    throw new Error("Simulation failed, nothing was sent.");
  }
  if (!send) {
    console.log("Dry run only. Add --send to create the pool on mainnet.");
    return;
  }

  const signature = await sendAndConfirmTransaction(connection, tx, [payer, configKeypair, baseMintKeypair]);
  console.log("Pool created:", `https://explorer.solana.com/tx/${signature}`);

  const pools = await client.state.getPoolsByConfig(configKeypair.publicKey);
  const pool = pools[0] && pools[0].publicKey.toBase58();
  console.log("Pool address:", pool);
  fs.writeFileSync(
    path.join(__dirname, "pool.json"),
    JSON.stringify(
      { pool, config: configKeypair.publicKey.toBase58(), baseMint: baseMintKeypair.publicKey.toBase58(), quoteMint: USDC_MINT.toBase58(), signature },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
