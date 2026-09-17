/**
 * Confirms the settlement written by test-settle.js can be read back —
 * the same logic lib/meteora/settlementReader.ts uses for the live app's
 * /api/protect/settlement route.
 */
const { Connection, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

const DEVNET_RPC = "https://api.devnet.solana.com";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const TREASURY = "2bgo1p6QqtnbVoDzevvYMBqundLuthB2icLbmKuoNvEp";

async function main() {
  const connection = new Connection(DEVNET_RPC, "confirmed");
  const signatures = await connection.getSignaturesForAddress(new PublicKey(TREASURY), { limit: 10 });

  for (const { signature } of signatures) {
    const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) continue;
    for (const ix of tx.transaction.message.instructions) {
      if (ix.programId.toBase58() !== MEMO_PROGRAM_ID) continue;

      let text;
      if ("parsed" in ix && typeof ix.parsed === "string") {
        text = ix.parsed;
      } else if ("data" in ix && typeof ix.data === "string") {
        text = Buffer.from(bs58.decode(ix.data)).toString("utf-8");
      } else {
        continue;
      }

      try {
        const parsed = JSON.parse(text);
        console.log("Found settlement record:", parsed);
        return;
      } catch {
        continue;
      }
    }
  }
  console.log("No settlement record found.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
