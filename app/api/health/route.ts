import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getMarketData } from "@/lib/marketData";
import { fetchPreStocks } from "@/lib/prestocks/client";
import { fetchPoolState } from "@/lib/meteora/quote";

/**
 * GET /api/health
 *
 * A quick check of everything the site depends on, so a problem shows up
 * here first: live prices, the pre-IPO feed, and both Gap Insurance pools.
 * Contains no secrets, only pass or fail and a few counts.
 */

type Check = { ok: boolean; detail: string; ms: number };

async function check(run: () => Promise<string>): Promise<Check> {
  const started = Date.now();
  try {
    const detail = await Promise.race([
      run(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timed out after 25s")), 25_000)),
    ]);
    return { ok: true, detail, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "failed", ms: Date.now() - started };
  }
}

export async function GET() {
  const mainnetPool = process.env.NEXT_PUBLIC_PROTECTION_POOL_MAINNET?.trim();
  const devnetPool = process.env.NEXT_PUBLIC_PROTECTION_POOL_DEVNET?.trim();

  const [prices, preIpo, mainnet, devnet] = await Promise.all([
    check(async () => {
      const data = await getMarketData();
      if (data.stocks.length === 0) throw new Error("no stocks returned");
      return `${data.stocks.length} stocks from ${data.source}`;
    }),
    check(async () => {
      const list = await fetchPreStocks();
      if (list.length === 0) throw new Error("no tokens returned");
      return `${list.length} pre-IPO tokens`;
    }),
    check(async () => {
      if (!mainnetPool || !process.env.SOLANA_RPC_URL) throw new Error("mainnet pool not configured");
      await fetchPoolState(new Connection(process.env.SOLANA_RPC_URL, "confirmed"), mainnetPool);
      return "pool readable";
    }),
    check(async () => {
      if (!devnetPool || !process.env.DEVNET_RPC_URL) throw new Error("devnet pool not configured");
      await fetchPoolState(new Connection(process.env.DEVNET_RPC_URL, "confirmed"), devnetPool);
      return "pool readable";
    }),
  ]);

  const checks = { prices, preIpo, mainnetPool: mainnet, devnetPool: devnet };
  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, checkedAt: new Date().toISOString(), checks },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

export const dynamic = "force-dynamic";
// Devnet's public RPC can take several seconds, so allow the check to finish.
export const maxDuration = 30;
