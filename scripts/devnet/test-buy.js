/**
 * Devnet dry run of the buy-protection flow: gets a real quote and
 * executes a real swap against the live devnet pool, using the same SDK
 * calls lib/meteora/quote.ts uses for the live app's /protect page.
 */
const { DynamicBondingCurveClient, getCurrentPoint } = require("@meteora-ag/dynamic-bonding-curve-sdk");
const { Connection, Keypair, sendAndConfirmTransaction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  const secret = JSON.parse(fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8"));
  const buyer = Keypair.fromSecretKey(Uint8Array.from(secret));
  const { pool: poolAddress } = JSON.parse(fs.readFileSync(path.join(__dirname, "pool.json"), "utf-8"));

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  const pool = await client.state.getPool(poolAddress);
  const config = await client.state.getPoolConfig(pool.poolState.config);
  const currentPoint = await getCurrentPoint(connection, config.activationType);

  const amountIn = new (require("bn.js"))(10_000_000); // 10 mock USDC (6dp)

  const quote = client.pool.swapQuote({
    virtualPool: pool,
    config,
    swapBaseForQuote: false,
    amountIn,
    slippageBps: 100,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
  });

  console.log(`Quote: 10 mock USDC -> ${quote.outputAmount.toString()} protection token base units`);

  const tx = await client.pool.swap({
    owner: buyer.publicKey,
    pool: new (require("@solana/web3.js").PublicKey)(poolAddress),
    amountIn,
    minimumAmountOut: quote.minimumAmountOut,
    swapBaseForQuote: false,
    referralTokenAccount: null,
  });

  const signature = await sendAndConfirmTransaction(connection, tx, [buyer]);
  console.log("Buy successful:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
