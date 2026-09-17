const { Connection, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = process.argv[2] || "https://api.devnet.solana.com";

async function main() {
  const secret = JSON.parse(
    fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8")
  );
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  console.log("Requesting devnet airdrop for", kp.publicKey.toBase58());
  const sig = await connection.requestAirdrop(kp.publicKey, 1 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");

  const balance = await connection.getBalance(kp.publicKey);
  console.log(`Balance now: ${balance / LAMPORTS_PER_SOL} SOL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
