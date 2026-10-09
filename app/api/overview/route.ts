import { NextResponse, after } from "next/server";
import { getCensus, refreshCensus } from "@/lib/kamino/census";
import { getLastRun } from "@/lib/alerts/store";
import { botUsername } from "@/lib/alerts/telegram";

/**
 * GET /api/overview
 *
 * What the command center needs beyond prices: the Monday shock map (how
 * many real Kamino borrowers each size of drop would liquidate) and whether
 * the Telegram alerts are running. The shock map is served from cache and
 * refreshed in the background after the response, so the page stays fast.
 */
export async function GET() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) return NextResponse.json({ error: "SOLANA_RPC_URL is not configured." }, { status: 500 });

  const [censusResult, lastRun, bot] = await Promise.all([
    getCensus(rpcUrl).catch((err) => {
      console.error("census failed:", err);
      return null;
    }),
    getLastRun().catch(() => null),
    botUsername(),
  ]);

  if (censusResult?.stale) {
    after(() => refreshCensus(rpcUrl).catch((err) => console.error("census refresh failed:", err)));
  }

  return NextResponse.json(
    {
      census: censusResult?.census ?? null,
      alerts: { bot, lastRun },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const dynamic = "force-dynamic";
// The very first read of every loan can take ~25 seconds.
export const maxDuration = 60;
