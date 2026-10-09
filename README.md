# GapGuard

A free tool that watches tokenized stocks on Solana and warns people when the price could jump suddenly.

**Live:** https://gapguard-alpha.vercel.app

Built for the Stocklana hackathon.

## The problem, in plain words

You can buy a "tokenized" version of Apple or Tesla stock on Solana, and trade it any time, day or night, weekends included. But the real Apple and Tesla shares only trade during normal stock market hours. So when the real market is closed, nobody is watching whether the token's price still matches the real stock's price. If something big happens overnight (an earnings report, big news), the token can suddenly jump when the market reopens, and anyone holding it or using it as collateral for a loan gets no warning at all.

GapGuard is a warning system for that gap.

## What it does

1. **The Radar** (the home page). Shows, live, how much the on-chain price of each tokenized stock has drifted from the real stock's price, and whether the real market is open or closed right now. Also shows how much money is sitting as tokenized-stock collateral on Kamino's lending market, and the same gap for pre-IPO tokens (OpenAI, SpaceX and others), measured against the issuer's own mark.
2. **Your risk** (`/portfolio`). Connect your wallet, or paste any public wallet address, and it reads your tokenized stock and pre-IPO holdings straight from the chain. If you've borrowed against tokenized stocks on Kamino, it tells you in plain words how far your stocks can fall before the loan can be liquidated, and roughly how much to repay or add to get back to safety. A slider shows what a price jump of any size would do.
3. **Weekend loan alerts** (Telegram). Press "Get free Telegram alerts" on Your risk, or message the bot a wallet address. It messages you on Friday before the stock market closes for the weekend, whenever your loan's safety cushion falls under 15%, 10% or 5%, and on Monday before the market opens. Every message says what to do. It's read-only: it never asks you to connect or sign anything.
4. **Gap Insurance** (`/protect`). Pay a small amount up front to protect yourself against a big price jump over a weekend. If the jump happens, you get paid back. If it doesn't, you don't. Built on a Meteora Dynamic Bonding Curve pool and settled from Pyth's real stock prices. It runs on mainnet (real money) and devnet (a free test network with a free faucet), and you pick one on the page.

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

Locally, the Telegram alerts work without any setup: messages are printed in the terminal instead of sent, and the subscriber list is kept in memory.

## Turning on Telegram alerts

Everything here is free. You do these once.

1. **Make the bot.** In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot` and pick a name. It gives you a token. Never share it.
2. **Make the database.** Sign up at [upstash.com](https://upstash.com), create a free Redis database, and copy its REST URL and REST token.
3. **Add the settings on Vercel** (Project, Settings, Environment Variables): `TELEGRAM_BOT_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `CRON_SECRET` (any long random text you make up). Then redeploy.
4. **Connect the bot to the site.** Open `https://<your-site>/api/alerts/setup?key=<CRON_SECRET>` once. It should answer with your bot's name.
5. **Start the 5-minute check.** Sign up at [cron-job.org](https://cron-job.org) and add a job that opens `https://<your-site>/api/alerts/check?key=<CRON_SECRET>` every 5 minutes.

`/api/health` then shows an `alerts` line. If the 5-minute check stops running, it turns red there within 15 minutes.

## What's in this folder

```
app/                    the web pages and their backend routes
lib/marketData/         picks live price data from Jupiter + Yahoo (or Pyth, once available)
lib/pyth/               the original Pyth integration, built and ready, not currently active
lib/kamino/             reads Kamino's tokenized-stock lending market and each wallet's loans
lib/alerts/             the Telegram alerts: when to warn, what to say, who's subscribed
lib/meteora/            the Gap Insurance pool, quoting, and payout logic
lib/solana/             reads a wallet's real tokenized-stock holdings
lib/stocks/             the 8 stocks GapGuard tracks
scripts/                one-off setup and settlement scripts
scripts/devnet/         free test-network versions of those scripts, for trying things safely
docs/submission.md      the full write-up for hackathon judges
```

## Current status

The app is live and working end to end: real Pyth prices, a wallet connected risk view, and a real buy, settlement and payout flow for Gap Insurance, proven with on-chain transactions listed in docs/submission.md. Settlement is run by a person with a script (it reads Pyth and writes the result on-chain), and payouts come from a builder controlled wallet, not an audited escrow contract. This is a hackathon project.
