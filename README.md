# GapGuard

A free tool that watches tokenized stocks on Solana and warns people when the price could jump suddenly.

**Live:** https://gapguard-alpha.vercel.app

Built for the Stocklana hackathon.

## The problem, in plain words

You can buy a "tokenized" version of Apple or Tesla stock on Solana, and trade it any time, day or night, weekends included. But the real Apple and Tesla shares only trade during normal stock market hours. So when the real market is closed, nobody is watching whether the token's price still matches the real stock's price. If something big happens overnight (an earnings report, big news), the token can suddenly jump when the market reopens, and anyone holding it or using it as collateral for a loan gets no warning at all.

GapGuard is a warning system for that gap.

## What it does

1. **The Radar** (the home page). Shows, live, how much the on-chain price of each tokenized stock has drifted from the real stock's price, and whether the real market is open or closed right now. Also shows how much money is sitting as tokenized-stock collateral on Kamino's lending market, and the same gap for pre-IPO tokens (OpenAI, SpaceX and others), measured against the issuer's own mark.
2. **Your risk** (`/portfolio`). Connect your wallet and it reads your actual tokenized stock and pre-IPO holdings straight from the chain, then lets you drag a slider to see what a price jump of any size would do to them, and, if you have a loan against these stocks on Kamino, how close that would put you to losing your collateral.
3. **Gap Insurance** (`/protect`). Pay a small amount up front to protect yourself against a big price jump over a weekend. If the jump happens, you get paid back. If it doesn't, you don't. Built on a Meteora Dynamic Bonding Curve pool and settled from Pyth's real stock prices. It runs on mainnet (real money) and devnet (a free test network with a free faucet), and you pick one on the page.

See [docs/submission.md](docs/submission.md) for the full write-up, including exactly what parts are fully automatic right now and what parts still need a person to run a script — we say this plainly instead of hiding it.

## Where the price data comes from

Real, live data, always, never sample or recorded numbers. The Radar runs on [Pyth Network](https://pyth.network): the real stock feed (`Equity.US.<TICKER>/USD`) against the on-chain xStock feed (`Crypto.<TICKER>X/USD`). If Pyth ever fails, it falls back automatically to [Jupiter's](https://jup.ag) token price API and [Yahoo Finance](https://finance.yahoo.com), both free with no signup. Pre-IPO prices come from [PreStocks'](https://prestocks.com) public API. The homepage always shows, in plain text, which source is live. See docs/submission.md for the full story.

## Running it yourself

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in `SOLANA_RPC_URL` (a Solana RPC endpoint, the public one works for trying it out). Add a `PYTH_API_KEY` to run on Pyth; without one the app uses the free fallback.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## What's in this folder

```
app/                    the web pages and their backend routes
lib/marketData/         picks live price data from Jupiter + Yahoo (or Pyth, once available)
lib/pyth/               the original Pyth integration, built and ready, not currently active
lib/kamino/             reads Kamino's tokenized-stock lending market
lib/meteora/            the Gap Insurance pool, quoting, and payout logic
lib/solana/             reads a wallet's real tokenized-stock holdings
lib/stocks/             the 8 stocks GapGuard tracks
scripts/                one-off setup and settlement scripts
scripts/devnet/         free test-network versions of those scripts, for trying things safely
docs/submission.md      the full write-up for hackathon judges
```

## Current status

The app is live and working end to end: real Pyth prices, a wallet connected risk view, and a real buy, settlement and payout flow for Gap Insurance, proven with on-chain transactions listed in docs/submission.md. Settlement is run by a person with a script (it reads Pyth and writes the result on-chain), and payouts come from a builder controlled wallet, not an audited escrow contract. This is a hackathon project.
