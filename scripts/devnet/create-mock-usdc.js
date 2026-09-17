/**
 * Creates a private test token on devnet to stand in for USDC. This is
 * NOT real USDC and has no value anywhere — it exists purely so the
 * DBC pool has a quote mint to test against, without depending on a
 * devnet USDC faucet (which has its own availability issues).
 */
const { Connection, Keypair } = require("@solana/web3.js");
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  const secret = JSON.parse(
    fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8")
  );
  const treasury = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  console.log("Creating mock USDC mint (devnet only, 6 decimals)...");
  const mint = await createMint(
    connection,
    treasury,
    treasury.publicKey,
    null,
    6
  );
  console.log("Mock USDC mint:", mint.toBase58());

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    treasury.publicKey
  );

  const amount = 10_000 * 10 ** 6; // 10,000 mock USDC
  await mintTo(connection, treasury, mint, ata.address, treasury, amount);
  console.log(`Minted 10,000 mock USDC to ${ata.address.toBase58()}`);

  fs.writeFileSync(
    path.join(__dirname, "mock-usdc.json"),
    JSON.stringify({ mint: mint.toBase58(), treasuryAta: ata.address.toBase58() }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
