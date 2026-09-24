import { PublicKey } from "@solana/web3.js";

/**
 * Config for the ONE demo Gap Insurance market GapGuard ships for the
 * hackathon: a single stock, a single Friday-close -> Monday-open window,
 * a single gap threshold. This is intentionally not a generalized
 * multi-market factory — see docs/submission.md for why that scoping
 * decision was made.
 */
export const PROTECTION_MARKETS = {
  // Live pool on Solana mainnet: the weekend right after submissions close,
  // so it settles during judging with real Pyth prices.
  mainnet: {
    ticker: "TSLA",
    windowLabel: "Fri Sep 25 4:00pm ET -> Mon Sep 28 9:30am ET",
    gapThresholdBps: 300, // 3%: pays out if the price at Monday's open
    // differs from Friday's close by more than this.
  },
  // Free test pool on devnet: the Sep 18-21 weekend, already played out.
  devnet: {
    ticker: "TSLA",
    windowLabel: "Fri Sep 18 4:00pm ET -> Mon Sep 21 9:30am ET",
    gapThresholdBps: 300,
  },
} as const;

export type NetworkId = keyof typeof PROTECTION_MARKETS;

/** The mainnet market, used by scripts/create-dbc-pool.ts. */
export const PROTECTION_MARKET = PROTECTION_MARKETS.mainnet;

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

/**
 * Config parameters feeding `buildCurveWithMarketCap()` +
 * `client.partner.createConfigAndPool(...)` in scripts/create-dbc-pool.ts.
 * This whole config was verified end-to-end on devnet on 2026-09-17 — a
 * real pool was created and is live (see docs/submission.md) — not just
 * type-checked.
 *
 * Key choices and why:
 *  - `quoteMint: USDC` — premiums and payouts are denominated in USDC, not
 *    SOL, so gap-insurance economics aren't polluted by SOL price moves.
 *  - `buildCurveWithMarketCap`, not `buildCurve` — the latter takes a raw
 *    `migrationQuoteThreshold` that gets scaled internally in an
 *    undocumented way tied to `totalTokenSupply`; two different "very
 *    high" values both threw "Not enough liquidity" trying to guess it by
 *    hand. `initialMarketCap`/`migrationMarketCap` are self-consistent by
 *    construction — the SDK derives the curve from them directly.
 *  - `migrationMarketCap` far above `initialMarketCap` so migration to a
 *    DAMM pool never realistically triggers — DBC here is being used
 *    purely as a transparent, on-chain sale curve for the protection
 *    token, not as a launchpad. A 50,000x ratio failed the curve's own
 *    internal math ("Not enough liquidity" again); 1,000x works.
 *  - `collectFeeMode: 0` (QuoteToken) — fees/premiums accumulate in USDC
 *    in the pool's quote reserve, which is exactly what a settlement
 *    script needs to read from to compute a payout.
 *  - `liquidityDistribution` percentages must sum to 100, and the
 *    protocol requires at least 10% permanently locked at day 1 (an
 *    anti-rug-pull rule enforced regardless of whether migration ever
 *    actually happens) — both confirmed by testing, not documented
 *    anywhere in the SDK's types or docs.md.
 *  - Metaplex token metadata caps the pool/token `name` at 32 bytes —
 *    confirmed by testing (33 bytes failed with "Name too long").
 */
export const DBC_CONFIG_PARAMS = {
  quoteMint: USDC_MINT,
  totalTokenSupply: 1_000_000,
  initialMarketCap: 1_000, // $1,000 starting valuation for 1,000,000 tokens
  migrationMarketCap: 1_000_000, // $1M — a 1,000x ratio, nowhere near
  // reachable by a single demo market's premium volume.
  collectFeeMode: 0, // CollectFeeMode.QuoteToken
  liquidityDistribution: {
    partnerLiquidityPercentage: 0,
    partnerPermanentLockedLiquidityPercentage: 0,
    creatorPermanentLockedLiquidityPercentage: 10,
    creatorLiquidityPercentage: 90,
  },
} as const;
