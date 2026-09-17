/**
 * Devnet dry run of the redemption ("payout") step: a plain SPL token
 * transfer of mock USDC from the treasury back to a protection-token
 * holder, standing in for the custodial payout described in
 * docs/submission.md (a backend-executed transfer, not an on-chain claim
 * program — that's the honest, stated scope for this build).
 */
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  const secret = JSON.parse(fs.readFileSync(path.join(__dirname, "treasury.json"), "utf-8"));
  const treasury = Keypair.fromSecretKey(Uint8Array.from(secret));
  const { mint: mockUsdcMint, treasuryAta } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "mock-usdc.json"), "utf-8")
  );

  const connection = new Connection(DEVNET_RPC, "confirmed");

  // In the real flow this would be the protection-token holder's wallet;
  // here we pay back to the treasury's own second holding to prove the
  // transfer mechanism works without needing a second funded wallet.
  const recipient = treasury.publicKey;
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    new PublicKey(mockUsdcMint),
    recipient
  );

  const payoutAmount = 5_000_000; // 5 mock USDC, matching a hypothetical payout
  const signature = await transfer(
    connection,
    treasury,
    new PublicKey(treasuryAta),
    recipientAta.address,
    treasury,
    payoutAmount
  );

  console.log("Payout transfer successful:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
