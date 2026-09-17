import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
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
export async function GET() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!rpcUrl || !treasuryAddress) {
    return NextResponse.json({ settlement: null });
  }

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const settlement = await findLatestSettlement(
      connection,
      treasuryAddress,
      PROTECTION_MARKET.ticker,
      PROTECTION_MARKET.windowLabel
    );
    return NextResponse.json({ settlement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
