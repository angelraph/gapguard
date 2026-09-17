const { Connection } = require("@solana/web3.js");
const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  const connection = new Connection(DEVNET_RPC, "confirmed");
  const sig = process.argv[2];
  const tx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 });
  console.log(JSON.stringify(tx.transaction.message.instructions, null, 2));
}

main().catch(console.error);
