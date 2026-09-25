/**
 * Settles the live MAINNET Gap Insurance window: Fri Sep 25 4:00pm ET to
 * Mon Sep 28 9:30am ET, TSLA, 3% trigger.
 *
 *   node scripts/mainnet/settle-window.js --preview   works any time: shows Friday's close and the pool, sends nothing
 *   node scripts/mainnet/settle-window.js             after Mon Sep 28 9:30am ET: the full settlement, dry run
 *   node scripts/mainnet/settle-window.js --send      writes the result on-chain (costs a fraction of a cent in SOL)
 *   node scripts/mainnet/settle-window.js --send --pay  also pays holders in real USDC if the trigger was crossed
 *
 * Prices come from Pyth's real TSLA stock feed at the exact window moments,
 * and their publish times are recorded in the on-chain record. It never pays
 * anyone unless --pay is given, because that moves real USDC.
 */
const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getMint,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  transfer,
} = require("@solana/spl-token");
const { DynamicBondingCurveClient } = require("@meteora-ag/dynamic-bonding-curve-sdk");
const fs = require("fs");
const path = require("path");

const RPC = process.env.MAINNET_RPC_URL || "https://solana-rpc.publicnode.com";
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Must match PROTECTION_MARKETS.mainnet in lib/meteora/dbcPool.ts exactly, or
// the app will not recognise the record.
const TICKER = "TSLA";
const WINDOW_LABEL = "Fri Sep 25 4:00pm ET -> Mon Sep 28 9:30am ET";
const THRESHOLD_BPS = 300;
const CLOSE_UNIX = Date.parse("2026-09-25T19:59:59Z") / 1000; // 3:59:59pm ET Friday
const OPEN_UNIX = Date.parse("2026-09-28T13:30:01Z") / 1000; // 9:30:01am ET Monday
const PYTH_EQUITY_FEED = "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"; // Equity.US.TSLA/USD
const DECIMALS = 6;

const preview = process.argv.includes("--preview");
const send = process.argv.includes("--send");
const pay = process.argv.includes("--pay");

function loadPayer() {
  const files = ["pool-wallet.key", "treasury.key"].map((f) => path.join(__dirname, f)).filter((f) => fs.existsSync(f));
  if (files.length) {
    const text = fs.readFileSync(files[0], "utf-8");
    const m = text.match(/[1-9A-HJ-NP-Za-km-z]{60,100}/);
    if (!m) throw new Error("Could not find a private key in " + path.basename(files[0]));
    const bs58 = require("bs58");
    return Keypair.fromSecretKey((bs58.default || bs58).decode(m[0]));
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8"))));
}

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
  if (!res.ok) throw new Error(`Pyth lookup failed (${res.status}) for ${new Date(unix * 1000).toISOString()}`);
  const p = (await res.json()).parsed[0].price;
  return { price: Number(p.price) * Math.pow(10, p.expo), publishTime: p.publish_time };
}

async function main() {
  const payer = loadPayer();
  const connection = new Connection(RPC, "confirmed");
  const { pool: poolAddress, baseMint } = JSON.parse(fs.readFileSync(path.join(__dirname, "pool.json"), "utf-8"));
  console.log("Settlement wallet:", payer.publicKey.toBase58());

  // Pool figures: USDC collected, and protection tokens sold.
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const pool = await client.state.getPool(new PublicKey(poolAddress));
  const quoteVault = await getAccount(connection, pool.poolState.quoteVault);
  const baseVault = await getAccount(connection, pool.poolState.baseVault);
  const mintInfo = await getMint(connection, new PublicKey(baseMint));
  const poolUsdc = Number(quoteVault.amount) / 10 ** DECIMALS;
  const tokensSold = Number(mintInfo.supply - baseVault.amount) / 10 ** DECIMALS;
  console.log(`Pool holds ${poolUsdc} USDC, ${tokensSold} protection tokens sold`);

  const close = await pythPriceAt(CLOSE_UNIX);
  console.log(`Friday close (Pyth): $${close.price.toFixed(2)}, published ${new Date(close.publishTime * 1000).toISOString()}`);

  const nowSec = Date.now() / 1000;
  if (nowSec < OPEN_UNIX + 30) {
    const mins = Math.ceil((OPEN_UNIX + 30 - nowSec) / 60);
    console.log(`\nThe window has not ended. Monday's open is about ${mins} minutes away (${Math.round(mins / 60)} hours).`);
    if (!preview) process.exitCode = 1;
    return;
  }
  if (preview) {
    console.log("Preview only: the window has ended, run without --preview to see the full result.");
    return;
  }

  const open = await pythPriceAt(OPEN_UNIX);
  console.log(`Monday open (Pyth): $${open.price.toFixed(2)}, published ${new Date(open.publishTime * 1000).toISOString()}`);

  const gapBps = Math.round((Math.abs(open.price - close.price) / close.price) * 10000);
  const triggered = gapBps >= THRESHOLD_BPS;
  const payoutPerTokenUsd = triggered && tokensSold > 0 ? poolUsdc / tokensSold : 0;
  const result = {
    ticker: TICKER,
    windowLabel: WINDOW_LABEL,
    closePrice: close.price,
    reopenPrice: open.price,
    gapBps,
    thresholdBps: THRESHOLD_BPS,
    triggered,
    payoutPerTokenUsd,
    settledAtIso: new Date().toISOString(),
    priceSource: "Pyth Equity.US.TSLA/USD",
    closePublishTime: close.publishTime,
    reopenPublishTime: open.publishTime,
  };
  console.log("Settlement result:", result);
  if (!send) {
    console.log("Dry run only. Add --send to record this on-chain.");
    return;
  }

  const memoIx = new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: Buffer.from(JSON.stringify(result), "utf-8") });
  const sig = await connection.sendTransaction(new Transaction().add(memoIx), [payer]);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Recorded on-chain: https://explorer.solana.com/tx/${sig}`);

  if (!triggered) return console.log("Gap was below the threshold, so no payout. Result is recorded.");
  if (tokensSold === 0) return console.log("Triggered, but no protection was sold, so nobody is owed anything.");

  let holders;
  try {
    holders = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: baseMint } }],
    });
  } catch (e) {
    return console.log("Triggered, but this RPC will not list holders (" + e.message.slice(0, 80) + "). Use an RPC that allows getProgramAccounts.");
  }
  const owed = [];
  for (const { pubkey } of holders) {
    if (pubkey.equals(pool.poolState.baseVault)) continue;
    const acct = await getAccount(connection, pubkey);
    if (acct.amount === 0n) continue;
    owed.push({ owner: acct.owner, usdc: (Number(acct.amount) / 10 ** DECIMALS) * payoutPerTokenUsd });
  }
  console.log("Owed:");
  owed.forEach((o) => console.log(`  ${o.owner.toBase58()}  ${o.usdc.toFixed(6)} USDC`));
  if (!pay) return console.log("Not paying: add --pay to send real USDC from the settlement wallet.");

  const from = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);
  for (const o of owed) {
    const to = await getOrCreateAssociatedTokenAccount(connection, payer, USDC_MINT, o.owner);
    const paySig = await transfer(connection, payer, from, to.address, payer, Math.floor(o.usdc * 10 ** DECIMALS));
    console.log(`Paid ${o.usdc.toFixed(6)} USDC to ${o.owner.toBase58()}: ${paySig}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
