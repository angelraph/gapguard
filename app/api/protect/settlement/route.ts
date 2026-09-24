import { NextResponse } from "next/server";
import { Connection, Keypair } from "@solana/web3.js";
import { findLatestSettlement } from "@/lib/meteora/settlementReader";
import { PROTECTION_MARKETS, type NetworkId } from "@/lib/meteora/dbcPool";

/**
 * GET /api/protect/settlement?network=mainnet|devnet
 *
 * Looks up whether that network's Gap Insurance window has been settled
 * yet, by reading the Memo record the settlement script wrote on-chain from
 * the treasury address (see lib/meteora/settlementReader.ts). Done
 * server-side so this doesn't run once per visitor against a public RPC.
 */

// Once found, a settlement never changes, so remember it instead of
// re-reading the treasury's history (which grows with every faucet mint).
const cache = new Map<NetworkId, unknown>();

function treasuryAddressFor(network: NetworkId): string | undefined {
  if (network === "mainnet") return process.env.TREASURY_ADDRESS_MAINNET?.trim();
  // The devnet treasury is the same keypair the faucet uses.
  const secret = process.env.TREASURY_KEYPAIR_SECRET;
  if (!secret) return undefined;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret))).publicKey.toBase58();
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("network");
  const network: NetworkId = requested === "mainnet" ? "mainnet" : "devnet";

  if (cache.has(network)) {
    return NextResponse.json({ settlement: cache.get(network) });
  }

  const rpcUrl =
    network === "mainnet" ? process.env.SOLANA_RPC_URL : process.env.DEVNET_RPC_URL;
  const treasuryAddress = treasuryAddressFor(network);
  if (!rpcUrl || !treasuryAddress) {
    return NextResponse.json({ settlement: null });
  }

  try {
    const market = PROTECTION_MARKETS[network];
    const settlement = await findLatestSettlement(
      new Connection(rpcUrl, "confirmed"),
      treasuryAddress,
      market.ticker,
      market.windowLabel,
      100
    );
    if (settlement) cache.set(network, settlement);
    return NextResponse.json({ settlement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
