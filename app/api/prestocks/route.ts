import { NextResponse } from "next/server";
import { fetchPreStocks, preStocksAgeMs } from "@/lib/prestocks/client";

/** GET /api/prestocks: pre-IPO tokens with the gap between the issuer's
 * mark and the live on-chain price. Free, no key needed. `ageMinutes` is
 * above 0 only while PreStocks is down and the last good prices are shown. */
export async function GET() {
  try {
    const stocks = await fetchPreStocks();
    const ageMinutes = Math.floor(preStocksAgeMs() / 60000);
    return NextResponse.json({ generatedAt: new Date().toISOString(), ageMinutes, stocks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
