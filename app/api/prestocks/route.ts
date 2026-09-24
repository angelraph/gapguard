import { NextResponse } from "next/server";
import { fetchPreStocks } from "@/lib/prestocks/client";

/** GET /api/prestocks: pre-IPO tokens with the gap between the issuer's
 * mark and the live on-chain price. Free, no key needed. */
export async function GET() {
  try {
    const stocks = await fetchPreStocks();
    return NextResponse.json({ generatedAt: new Date().toISOString(), stocks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
