# GapGuard

A free tool that watches tokenized stocks on Solana and warns people when the price could jump suddenly.

**Live:** https://gapguard-alpha.vercel.app

Built for the Stocklana hackathon.

## The problem, in plain words

You can buy a "tokenized" version of Apple or Tesla stock on Solana, and trade it any time, day or night, weekends included. But the real Apple and Tesla shares only trade during normal stock market hours. So when the real market is closed, nobody is watching whether the token's price still matches the real stock's price. If something big happens overnight (an earnings report, big news), the token can suddenly jump when the market reopens, and anyone holding it or using it as collateral for a loan gets no warning at all.

GapGuard is a warning system for that gap.

## What it does

1. **The Radar** (the home page). Shows, live, how much the tokenized price of each stock has drifted from its real-world price, and whether the real market is open or closed right now. Also shows how much money is sitting as tokenized-stock collateral on Kamino's lending market right now.
2. **Your risk** (`/portfolio`). Connect your wallet and it reads your actual tokenized-stock holdings straight from the chain, then lets you drag a slider to see what a price jump of any size would do to them — and, if you have a loan against these stocks on Kamino, how close that would put you to losing your collateral.
3. **Gap Insurance** (`/protect`). A simple way to pay a small amount up front to protect yourself against a big price jump over a weekend. If the jump happens, you get paid back. If it doesn't, you don't. Built using a Meteora Dynamic Bonding Curve pool and checked against real price data.

See [docs/submission.md](docs/submission.md) for the full write-up, including exactly what parts are fully automatic right now and what parts still need a person to run a script — we say this plainly instead of hiding it.

## Where the price data comes from

Real, live data, always — never sample or recorded numbers. Right now that's [Jupiter's](https://jup.ag) public token price API (for the on-chain token price) and [Yahoo Finance's](https://finance.yahoo.com) public stock quotes (for the real-world price), both free and needing no signup. The site was originally built around Pyth Network's price feeds, and that code is still there and ready to switch on, but Pyth's stock data sits behind a paid plan ($5,000+/month) with no free tier for a project like this — see docs/submission.md for the full story. The homepage always shows, in plain text, which source is live.

## Running it yourself

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in `SOLANA_RPC_URL` (a Solana RPC endpoint — the public one works for trying it out).

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

The app is live and working end-to-end: real prices, a real wallet-connected portfolio view, and a real (tested) buy flow for Gap Insurance. The one thing not live yet is an actual Gap Insurance pool on-chain — creating one takes real money, so that's a deliberate choice being made carefully rather than something skipped by accident. See docs/submission.md for the full picture.
