import { createSolanaRpc, address, type Address } from "@solana/kit";
import { KaminoMarket } from "@kamino-finance/klend-sdk";

/**
 * Kamino's dedicated xStocks lending market, resolved via Kamino's public
 * Markets API on 2026-09-16:
 *
 *   GET https://api.kamino.finance/v2/kamino-market?programId=KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
 *
 * That call lists every Kamino market; the row labeled "xStocks Market"
 * carries this address. (There is also a separate "Sentora xStocks Market"
 * — a different, smaller venue — do not confuse the two.)
 */
export const KAMINO_XSTOCKS_MARKET_ADDRESS: Address = address(
  "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua"
);

export const KAMINO_LEND_PROGRAM_ID: Address = address(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
);

/**
 * klend-sdk (as installed) is built on `@solana/kit`'s `Rpc` type, not
 * classic `@solana/web3.js`'s `Connection` — confirmed by reading
 * node_modules/@kamino-finance/klend-sdk/dist/classes/market.d.ts directly
 * (its `KaminoMarket.load` signature takes `Rpc<KaminoMarketRpcApi>` and
 * `Address`). This is a *different* RPC client than the one
 * `@solana/wallet-adapter-react` uses elsewhere in the app — that's fine,
 * the two stacks can coexist, but don't try to pass a web3.js `Connection`
 * here.
 */
export function createKaminoRpc(rpcUrl: string) {
  return createSolanaRpc(rpcUrl);
}

/** Solana's average slot time; klend-sdk uses this for interest-accrual math. */
const RECENT_SLOT_DURATION_MS = 450;

let cachedMarket: KaminoMarket | null = null;
let cachedAtMs = 0;
const MARKET_CACHE_TTL_MS = 30_000;

/** Load (and briefly cache) the xStocks KaminoMarket, with reserves loaded. */
export async function loadXStocksMarket(
  rpcUrl: string
): Promise<KaminoMarket> {
  const now = Date.now();
  if (cachedMarket && now - cachedAtMs < MARKET_CACHE_TTL_MS) {
    return cachedMarket;
  }

  const rpc = createKaminoRpc(rpcUrl);
  const market = await KaminoMarket.load(
    rpc,
    KAMINO_XSTOCKS_MARKET_ADDRESS,
    RECENT_SLOT_DURATION_MS,
    KAMINO_LEND_PROGRAM_ID
    // withReserves defaults to true — no separate loadReserves() call needed.
  );
  if (!market) {
    throw new Error(
      `Failed to load Kamino xStocks market at ${KAMINO_XSTOCKS_MARKET_ADDRESS}`
    );
  }

  cachedMarket = market;
  cachedAtMs = now;
  return market;
}
