/**
 * Settles the real TSLA Gap Insurance window on devnet.
 *
 *   node scripts/devnet/settle-window.js          dry run
 *   node scripts/devnet/settle-window.js --send   writes on-chain
 *
 * Uses Friday's close and Monday's open from Pyth's real TSLA stock feed,
 * and records the Pyth timestamps on-chain so the result can be re-checked.
 *
 * If the gap crosses the threshold, it also pays each protection token
 * holder their share from the treasury. If not, nobody is paid and the
 * result is still recorded on-chain, so the outcome is verifiable either way.
 */
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  transfer,
} = require("@solana/spl-token");
const { DynamicBondingCurveClient } = require("@meteora-ag/dynamic-bonding-curve-sdk");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

// Must match PROTECTION_MARKET in lib/meteora/dbcPool.ts exactly, or the
// app will not recognise the record.
const TICKER = "TSLA";
const WINDOW_LABEL = "Fri Sep 18 4:00pm ET -> Mon Sep 21 9:30am ET";
const THRESHOLD_BPS = 300;
const USDC_DECIMALS = 6;
const TOKEN_DECIMALS = 6;

// The window is Friday's close to Monday's open. Both prices come from
// Pyth's real stock feed (Equity.US.TSLA/USD) at those exact moments, not
// from the price right now, so this gives the same answer whenever it runs.
// Close = the last print at or before 4:00pm ET Friday. Open = the first
// print at or after 9:30am ET Monday.
const CLOSE_UNIX = Date.parse("2026-09-18T19:59:59Z") / 1000; // 3:59:59pm ET
const OPEN_UNIX = Date.parse("2026-09-21T13:30:01Z") / 1000; // 9:30:01am ET
const PYTH_EQUITY_FEED = "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"; // Equity.US.TSLA/USD

function pythKey() {
  if (process.env.PYTH_API_KEY) return process.env.PYTH_API_KEY;
  const env = fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf-8");
  return env.match(/^PYTH_API_KEY=(.*)$/m)[1].trim();
}

async function pythPriceAt(unix) {
  const res = await fetch(
    `https://hermes.pyth.network/v2/updates/price/${unix}?ids[]=${PYTH_EQUITY_FEED}&parsed=true`,
    { headers: { Authorization: `Bearer ${pythKey()}` } }
  );
  if (!res.ok) throw new Error(`Pyth lookup failed (${res.status}) for ${unix}`);
  const p = (await res.json()).parsed[0].price;
  return { price: Number(p.price) * Math.pow(10, p.expo), publishTime: p.publish_time };
}

async function fetchWindowPrices() {
  const close = await pythPriceAt(CLOSE_UNIX);
  const open = await pythPriceAt(OPEN_UNIX);
  return { close, open };
}

async function main() {
  const send = process.argv.includes("--send");

  const treasury = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8")))
  );
  const { pool: poolAddress, baseMint } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "pool.json"), "utf-8")
  );
  const { mint: usdcMint, treasuryAta } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "mock-usdc.json"), "utf-8")
  );
  const connection = new Connection(DEVNET_RPC, "confirmed");

  const prices = await fetchWindowPrices();
  const closePrice = prices.close.price;
  const reopen = { price: prices.open.price };
  console.log(
    `Pyth close $${closePrice.toFixed(2)} (published ${new Date(prices.close.publishTime * 1000).toISOString()}), ` +
      `open $${reopen.price.toFixed(2)} (published ${new Date(prices.open.publishTime * 1000).toISOString()})`
  );

  // Pool figures: USDC collected in the pool, and protection tokens sold.
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const pool = await client.state.getPool(new PublicKey(poolAddress));
  const quoteVault = await getAccount(connection, pool.poolState.quoteVault);
  const baseVault = await getAccount(connection, pool.poolState.baseVault);
  const mintInfo = await getMint(connection, new PublicKey(baseMint));
  const poolUsdc = Number(quoteVault.amount) / 10 ** USDC_DECIMALS;
  const tokensSold = Number(mintInfo.supply - baseVault.amount) / 10 ** TOKEN_DECIMALS;
  console.log(`Pool holds ${poolUsdc} USDC, ${tokensSold} protection tokens sold`);

  const gapBps = Math.round((Math.abs(reopen.price - closePrice) / closePrice) * 10000);
  const triggered = gapBps >= THRESHOLD_BPS;
  const payoutPerTokenUsd = triggered && tokensSold > 0 ? poolUsdc / tokensSold : 0;

  const result = {
    ticker: TICKER,
    windowLabel: WINDOW_LABEL,
    closePrice,
    reopenPrice: reopen.price,
    gapBps,
    thresholdBps: THRESHOLD_BPS,
    triggered,
    payoutPerTokenUsd,
    settledAtIso: new Date().toISOString(),
    // So anyone can re-check these exact prices against Pyth themselves.
    priceSource: "Pyth Equity.US.TSLA/USD",
    closePublishTime: prices.close.publishTime,
    reopenPublishTime: prices.open.publishTime,
  };
  console.log("Settlement result:", result);

  if (!send) {
    console.log("Dry run only. Add --send to record this on-chain and pay holders.");
    return;
  }

  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(JSON.stringify(result), "utf-8"),
  });
  const sig = await connection.sendTransaction(new Transaction().add(memoIx), [treasury]);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Recorded on-chain: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  if (!triggered) {
    console.log("Gap was below the threshold, so no payout. Result is recorded.");
    return;
  }

  const holders = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: baseMint } }],
  });
  for (const { pubkey } of holders) {
    if (pubkey.equals(pool.poolState.baseVault)) continue;
    const acct = await getAccount(connection, pubkey);
    if (acct.amount === 0n) continue;
    const owed = Math.floor((Number(acct.amount) / 10 ** TOKEN_DECIMALS) * payoutPerTokenUsd * 10 ** USDC_DECIMALS);
    if (owed <= 0) continue;
    const dest = await getOrCreateAssociatedTokenAccount(connection, treasury, new PublicKey(usdcMint), acct.owner);
    const paySig = await transfer(connection, treasury, new PublicKey(treasuryAta), dest.address, treasury, owed);
    console.log(`Paid ${owed / 10 ** USDC_DECIMALS} USDC to ${acct.owner.toBase58()}: ${paySig}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
