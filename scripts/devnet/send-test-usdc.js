const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";
const RECIPIENT = process.argv[2];
const AMOUNT_USDC = Number(process.argv[3] || "50");

async function main() {
  if (!RECIPIENT) throw new Error("Usage: node send-test-usdc.js <recipient> [amount]");

  const secret = JSON.parse(fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8"));
  const treasury = Keypair.fromSecretKey(Uint8Array.from(secret));
  const { mint: mockUsdcMint, treasuryAta } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "mock-usdc.json"), "utf-8")
  );

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const recipientPubkey = new PublicKey(RECIPIENT);

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    new PublicKey(mockUsdcMint),
    recipientPubkey
  );

  const amount = Math.round(AMOUNT_USDC * 10 ** 6);
  const signature = await transfer(
    connection,
    treasury,
    new PublicKey(treasuryAta),
    recipientAta.address,
    treasury,
    amount
  );

  console.log(`Sent ${AMOUNT_USDC} test USDC to ${RECIPIENT}`);
  console.log(`Their ATA: ${recipientAta.address.toBase58()}`);
  console.log(`Tx: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
