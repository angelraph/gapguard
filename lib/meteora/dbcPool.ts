import { PublicKey } from "@solana/web3.js";

/**
 * Config for the ONE demo Gap Insurance market GapGuard ships for the
 * hackathon: a single stock, a single Friday-close -> Monday-open window,
 * a single gap threshold. This is intentionally not a generalized
 * multi-market factory — see docs/submission.md for why that scoping
 * decision was made.
 */
export const PROTECTION_MARKET = {
  ticker: "TSLA", // or AAPL — pick whichever ticker's feed pair looks
  // cleanest once live data is actually being watched on day 1; both are
  // confirmed to have equity + xstock + ondo feeds.
  windowLabel: "Fri Sep 18 4:00pm ET -> Mon Sep 21 9:30am ET",
  gapThresholdBps: 300, // 3% — protection pays out if the equity price at
  // Monday's reopen differs from Friday's close by more than this.
} as const;

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

/**
 * Config parameters feeding `buildCurve()` + `client.partner.createConfigAndPool(...)`
 * in scripts/create-dbc-pool.ts. Verified against the installed
 * `@meteora-ag/dynamic-bonding-curve-sdk` types (dist/index.d.ts):
 * `buildCurve`'s `migrationQuoteThreshold` is a plain `number` (not `BN`),
 * and `CollectFeeMode.QuoteToken === 0`.
 *
 * Key choices and why:
 *  - `quoteMint: USDC` — premiums and payouts are denominated in USDC, not
 *    SOL, so gap-insurance economics aren't polluted by SOL price moves.
 *  - `migrationQuoteThreshold` set far above any premium volume this demo
 *    could plausibly reach, so the pool never graduates to a DAMM pool
 *    mid-demo — DBC here is being used purely as a transparent, on-chain
 *    sale curve for the protection token, not as a launchpad.
 *  - `collectFeeMode: 0` (QuoteToken) — fees/premiums accumulate in USDC
 *    in the pool's quote reserve, which is exactly what a settlement
 *    script needs to read from to compute a payout.
 */
export const DBC_CONFIG_PARAMS = {
  quoteMint: USDC_MINT,
  migrationQuoteThreshold: 1_000_000_000_000, // 1,000,000 USDC (6dp) —
  // effectively unreachable for a single demo market's premium volume.
  collectFeeMode: 0, // CollectFeeMode.QuoteToken
} as const;
