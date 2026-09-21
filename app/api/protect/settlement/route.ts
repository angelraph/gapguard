import { NextResponse } from "next/server";
import { Connection, Keypair } from "@solana/web3.js";
import { findLatestSettlement } from "@/lib/meteora/settlementReader";
import { PROTECTION_MARKET } from "@/lib/meteora/dbcPool";

/**
 * GET /api/protect/settlement
 *
 * Looks up whether the demo Gap Insurance window has been settled yet, by
 * scanning the treasury address's transaction history for the Memo record
 * scripts/settle-window.ts writes (see lib/meteora/settlementReader.ts).
 * Done server-side so this scan doesn't run once per visitor's browser
 * against the free public RPC.
 */
// Once found, a settlement never changes, so remember it instead of
// re-scanning the treasury's history (which grows with every faucet mint).
let cached: unknown = null;

export async function GET() {
  if (cached) return NextResponse.json({ settlement: cached });

  // The pool lives on devnet when NEXT_PUBLIC_NETWORK=devnet, so the record
  // does too. SOLANA_RPC_URL stays mainnet for Radar and Your risk.
  const isDevnet = process.env.NEXT_PUBLIC_NETWORK === "devnet";
  const rpcUrl = isDevnet ? process.env.DEVNET_RPC_URL : process.env.SOLANA_RPC_URL;

  let treasuryAddress = process.env.TREASURY_ADDRESS;
  const treasurySecret = process.env.TREASURY_KEYPAIR_SECRET;
  if (!treasuryAddress && treasurySecret) {
    try {
      treasuryAddress = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(treasurySecret))
      ).publicKey.toBase58();
    } catch {
      treasuryAddress = undefined;
    }
  }

  if (!rpcUrl || !treasuryAddress) {
    return NextResponse.json({ settlement: null });
  }

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const settlement = await findLatestSettlement(
      connection,
      treasuryAddress,
      PROTECTION_MARKET.ticker,
      PROTECTION_MARKET.windowLabel,
      100
    );
    if (settlement) cached = settlement;
    return NextResponse.json({ settlement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
