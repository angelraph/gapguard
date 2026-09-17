import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/marketData";
import { loadXStocksMarket } from "@/lib/kamino/client";
import { computeAggregateExposure } from "@/lib/kamino/exposure";

/**
 * GET /api/radar/summary
 *
 * Returns the live per-stock basis data plus the aggregate Kamino
 * exposure number that powers the Radar front page. The two data sources
 * fail independently — if Kamino is unreachable, the route still returns
 * the price data with `exposure: null` rather than taking the whole Radar
 * down over a secondary number.
 *
 * The price data itself comes from whichever source lib/marketData is
 * currently pointed at (see that file) — right now the free Jupiter +
 * Yahoo Finance combo, with Pyth wired up and ready to switch back to.
 * The response's `source` field tells the frontend which one is live, so
 * the page can label it honestly instead of assuming Pyth.
 */
export async function GET() {
  try {
    const { source, stocks } = await getMarketData();

    let exposure = null;
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL;
      if (rpcUrl) {
        const market = await loadXStocksMarket(rpcUrl);
        exposure = computeAggregateExposure(market);
      }
    } catch (exposureErr) {
      console.error("Kamino exposure fetch failed:", exposureErr);
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source,
      stocks,
      exposure,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
