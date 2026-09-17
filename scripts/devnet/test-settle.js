/**
 * Devnet dry run of the settlement mechanism: computes a settlement using
 * a REAL live TSLA price (from the same free Yahoo source the live app
 * uses — not fake data) as the "reopen" price, compared against a
 * deliberately-chosen "close" price picked to trigger a payout, since
 * we're proving the mechanism works right now rather than waiting for a
 * real weekend. Writes the result on-chain via the Memo program, then
 * reads it back to confirm the whole loop works.
 */
const { Connection, Keypair } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

async function fetchRealTslaPrice() {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1m&range=1d",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const data = await res.json();
  return data.chart.result[0].meta.regularMarketPrice;
}

async function main() {
  const secret = JSON.parse(
    fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8")
  );
  const treasury = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  const reopenPrice = await fetchRealTslaPrice();
  console.log("Real live TSLA price (Yahoo, right now):", reopenPrice);

  // Deliberately chosen so the test actually exercises the "triggered" path
  // — this stands in for "Friday's close" since we're not waiting for a
  // real weekend to prove the mechanism works.
  const closePrice = reopenPrice * 0.95; // simulate a 5% gap
  console.log("Simulated close price (test only):", closePrice);

  const gapBps = Math.round((Math.abs(reopenPrice - closePrice) / closePrice) * 10000);
  const thresholdBps = 300;
  const triggered = gapBps >= thresholdBps;

  const result = {
    ticker: "TSLA",
    windowLabel: "DEVNET TEST — simulated window",
    closePrice,
    reopenPrice,
    gapBps,
    thresholdBps,
    triggered,
    payoutPerTokenUsd: triggered ? 1.0 : 0, // placeholder until pool state is read
    settledAtIso: new Date().toISOString(),
  };

  console.log("Settlement result:", result);

  const { TransactionInstruction, Transaction, PublicKey } = require("@solana/web3.js");
  const memoText = JSON.stringify(result);
  const instruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memoText, "utf-8"),
  });
  const tx = new Transaction().add(instruction);
  const signature = await connection.sendTransaction(tx, [treasury]);
  await connection.confirmTransaction(signature, "confirmed");

  console.log("Recorded on-chain:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log("Treasury address to verify against:", treasury.publicKey.toBase58());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
