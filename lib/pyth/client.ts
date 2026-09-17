/**
 * Thin wrapper around Pyth's Hermes REST API.
 *
 * Two endpoints, two very different auth requirements (verified live on
 * 2026-09-16, after Pyth's Aug 2026 Hermes upgrade):
 *  - `/v2/price_feeds` (metadata/search)   -> public, no key needed.
 *  - `/v2/updates/price/latest` (live data) -> requires `PYTH_API_KEY`,
 *    returns 401 without it.
 *
 * This file should only ever be imported from server-side code (API routes,
 * scripts) — never from a client component — because it needs PYTH_API_KEY.
 */

const HERMES_BASE_URL = "https://hermes.pyth.network";

export type HermesParsedPrice = {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
};

export type HermesLatestPriceResponse = {
  parsed: HermesParsedPrice[];
};

/**
 * Fetch the latest parsed price update for a batch of feed IDs in one call.
 * Batch everything you need per poll cycle — Hermes accepts many `ids[]`
 * params in a single request, and batching keeps us well under whatever
 * rate limit the API key's plan enforces.
 */
export async function fetchLatestPrices(
  feedIds: string[]
): Promise<HermesParsedPrice[]> {
  const apiKey = process.env.PYTH_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PYTH_API_KEY is not set. Sign up at the Pyth Terminal to get a key, then add it to .env.local."
    );
  }

  const params = new URLSearchParams();
  for (const id of feedIds) params.append("ids[]", id);
  params.set("parsed", "true");

  const res = await fetch(
    `${HERMES_BASE_URL}/v2/updates/price/latest?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      // Prices should never be cached by Next.js's fetch cache.
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hermes price fetch failed (${res.status}): ${body}`);
  }

  const data: HermesLatestPriceResponse = await res.json();
  return data.parsed;
}

export type HermesFeedMetadata = {
  id: string;
  market_hours: {
    is_open: boolean;
    next_open: number | null;
    next_close: number | null;
  };
  attributes: {
    asset_type: string;
    description: string;
    display_symbol: string;
    quote_currency: string;
    symbol: string;
  };
};

/**
 * Search Pyth's feed metadata (no API key required). Mainly useful for
 * resolving new feed IDs during development — production code should use
 * the hardcoded IDs in `feedIds.ts` rather than searching on every request.
 */
export async function searchFeeds(
  query: string
): Promise<HermesFeedMetadata[]> {
  const res = await fetch(
    `${HERMES_BASE_URL}/v2/price_feeds?query=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Hermes feed search failed (${res.status})`);
  }
  return res.json();
}

/** Convert Hermes's (price, expo) integer encoding into a plain number. */
export function toDecimal(price: string, expo: number): number {
  return Number(price) * Math.pow(10, expo);
}
