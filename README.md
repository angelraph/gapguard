# GapGuard

A free tool that watches tokenized stocks on Solana and warns people when the price could jump suddenly.

Built for the Stocklana hackathon.

## The problem, in plain words

You can buy a "tokenized" version of Apple or Tesla stock on Solana, and trade it any time, day or night, weekends included. But the real Apple and Tesla shares only trade during normal stock market hours. So when the real market is closed, nobody is watching whether the token's price still matches the real stock's price. If something big happens overnight (an earnings report, big news), the token can suddenly jump when the market reopens, and anyone holding it or using it as collateral for a loan gets no warning at all.

GapGuard is a warning system for that gap.

## What it does

1. **The Radar** (the home page). Shows, live, how much the tokenized price of each stock has drifted from its real-world price, and whether the real market is open or closed right now.
2. **Your risk** (`/portfolio`). Connect your wallet and see what a sudden price jump would do to your own holdings.
3. **Gap Insurance** (`/protect`). A simple way to pay a small amount up front to protect yourself against a big price jump over a weekend. If the jump happens, you get paid back. If it doesn't, you don't. Built using Meteora and checked against Pyth's price data.

See [docs/submission.md](docs/submission.md) for the full write-up, including exactly what parts are fully automatic right now and what parts still need a person to run a script (we say this plainly instead of hiding it).

## Running it yourself

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in `PYTH_API_KEY` (see the comments in that file for where to get one) and `SOLANA_RPC_URL`.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## What's in this folder

```
app/                    the web pages and their backend routes
lib/pyth/               talks to Pyth's price feeds, and the drift math
lib/kamino/             reads Kamino's tokenized-stock lending market
lib/meteora/            the Gap Insurance pool and payout logic
lib/stocks/             the 8 stocks GapGuard tracks
scripts/                one-off setup and settlement scripts
docs/submission.md      the full write-up for hackathon judges
```

## Current status

The app builds and runs. The one open item is that Pyth's stock price feeds require a paid plan we don't have yet — see docs/submission.md for what that means and what we're doing about it.
