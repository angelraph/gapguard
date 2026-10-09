# GapGuard

**Your stock tokens trade all weekend. The real market doesn't. GapGuard warns you before Monday morning costs you money.**

**Live:** https://gapguard-alpha.vercel.app
**Telegram alerts:** [@GAPSTOCK_BOT](https://t.me/GAPSTOCK_BOT)

Free. Read-only. You never connect a wallet or sign anything to check your risk.

## A Monday morning, without GapGuard

Say you hold $4,000 of tokenized Tesla on Solana and you've borrowed $2,350 against it on Kamino. On Friday at 4pm the real stock market closes. Your token keeps trading all weekend, but the real Tesla price it's meant to follow stands still until Monday.

On Sunday night some big news breaks. Monday at 9:30am the real market opens, Tesla drops 10%, and your token drops with it in a few minutes. Kamino sees your collateral fall past its limit and closes part of your loan automatically. It sells some of your Tesla at a discount to pay back the debt. That's called a liquidation, and it's over before you've finished your coffee.

Nobody warned you on Friday that a drop of just under 10% was your breaking point. Nobody told you on Sunday night. Nothing in the market does that today.

GapGuard does.

## The problem

Tokenized stocks trade at every hour of every day. The real stock market is open about 32 hours a week. For the other 135 hours, the token moves on its own while the real price is frozen.

When the market reopens, the token has to snap back to the real price, sometimes in one jump. That jump is the gap.

If you just hold the token, a gap is a nasty surprise. If you borrowed against it, a gap can liquidate you before you can do anything about it.

## Who it's for

These are real numbers from Kamino's xStocks lending market, read on October 9, 2026, loan by loan:

1. **1,563 open loans** sit on tokenized stocks, with about **$5.4 million** borrowed.
2. **69 of them**, with about **$421,000** borrowed, would be liquidated if stocks opened **15%** lower.
3. **31**, with about **$171,000** borrowed, would go at a **10%** drop. **5** already break at **4%**.

Tesla, MicroStrategy and Robinhood make moves like that over a weekend more often than most people think. These borrowers are who GapGuard is built for first.

You don't have to take these numbers on trust. The **Monday shock map** on the [command center](https://gapguard-alpha.vercel.app) recounts them from every loan on Kamino every 15 minutes. Pick a drop and it shows how many real borrowers that move would liquidate.

It's also for anyone holding tokenized stocks who wants to see, at a glance, how far their token has wandered from the real price while the market is shut.

## What you get

**Your breaking point, in one sentence.** Paste any Solana wallet on the [Your risk](https://gapguard-alpha.vercel.app/portfolio) page. If it has a loan on Kamino's xStocks market, GapGuard tells you something like "survives a drop of up to 12.7%", and exactly how much to repay or add to get back to a safe 25% cushion. It finds your loan even though your stocks sit inside Kamino and your wallet looks empty, which is where most tools go blind.

**A warning on Telegram, while there's still time.** Send your wallet address to [@GAPSTOCK_BOT](https://t.me/GAPSTOCK_BOT), or press the button on Your risk. You'll hear from it:

1. on Friday, an hour before the market closes for the weekend
2. the moment your cushion falls under 15%, then 10%, then 5%
3. on Monday, in the hour before the market opens

Every message tells you what to do and links straight to Kamino. Each warning goes out once, so it never turns into noise. No app to install, no account to make.

**A live command center.** The home page shows whether the US market is open and when that changes, how much stock collateral sits on Kamino, the Monday shock map, whether the alerts are running, and the widest gaps right now. Every page is numbered 01 to 06 in a sidebar (swipeable tabs on a phone), and each one ends with a button to the next, so a first-time visitor can walk through the whole thing in order.

**The gap, live.** The Gap radar page shows how far each of 8 tokenized stocks (Apple, Alphabet, Nvidia, Tesla, Robinhood, MicroStrategy, SPY and QQQ) has drifted from the real stock right now, whether the real market is open, and how much money sits as collateral on Kamino. It does the same for pre-IPO tokens like OpenAI and SpaceX, measured against the issuer's own price.

**Weekend Gap Insurance, as a working demo.** Pay a small fee before the weekend. If the stock moves more than 3% by Monday's open, you get paid. It has already run on mainnet with real money: over the weekend of September 25 to 28, Tesla moved 1.04%, under the trigger, so no payout. The result is written on-chain with Pyth's prices so anyone can check it. Real insurance needs money set aside to pay claims, so it stays a demo for now and the free warnings come first.

## Why GapGuard is different

1. **It uses the same numbers Kamino uses.** Kamino decides liquidations with its own price feed. GapGuard reads that same feed, so "survives a drop of up to 12.7%" is the line that actually matters, not a guess from a stock chart.
2. **It sees loans other tools miss.** A borrower's stocks are held inside Kamino, so their wallet looks empty. GapGuard reads the loan itself, for every loan type, including leveraged ones.
3. **It warns before the gap, not after.** Price alerts tell you something already happened. GapGuard is built around the weekend: it tells you on Friday what Monday could do, and keeps watching in between.
4. **It tells you what to do.** Every warning comes with a number: repay this much, or add this much.
5. **It costs nothing and asks for nothing.** No sign-up, no wallet connection, no fees. It reads public data and sends you a message.

## The vision

Tokenized stocks are going to get bigger, and they'll keep trading while the real market sleeps. Every one of them carries this gap. GapGuard wants to be the thing standing in it: the safety layer that tells people, plainly and in time, what a closed market could do to their money.

Where it goes from here:

1. **Today:** free risk checks and Telegram warnings for everyone borrowing against tokenized stocks on Kamino.
2. **Next:** more lending apps, more stocks, warnings before market holidays as well as weekends, and GapGuard's warning shown right inside lending apps, where borrowers already are.
3. **Later:** once people trust the warnings, real weekend protection for the same people, so they can choose to cover the risk instead of just watching it.

The warnings stay free. That part isn't up for negotiation.

## Where the data comes from

Always real and live, never sample numbers.

1. **Loans and breaking points** come straight from Kamino's lending market on Solana, priced with the same feed Kamino uses for liquidations.
2. **The gap on the home page** compares the token's live price on [Jupiter](https://jup.ag) with the real stock price from [Yahoo Finance](https://finance.yahoo.com), both free. A full [Pyth Network](https://pyth.network) integration is built and switches back on with one setting once Pyth's stock data is available to the project. The home page always says which source is live.
3. **Pre-IPO prices** come from [PreStocks'](https://prestocks.com) public API. If PreStocks goes down for a moment, GapGuard shows the last good prices and says how old they are.
4. **Gap Insurance results** use Pyth's real stock prices, written on-chain.

Built for the Stocklana hackathon. The full write-up is in [docs/submission.md](docs/submission.md).

## Running it yourself

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in `SOLANA_RPC_URL` (a Solana RPC endpoint, the public one works for trying it out). Add a `PYTH_API_KEY` to run on Pyth; without one the app uses the free source.

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
3. **Add the settings on Vercel** (Project, Settings, Environment Variables): `TELEGRAM_BOT_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `CRON_SECRET` (any long random text made of letters and numbers). Then redeploy.
4. **Connect the bot to the site.** Open `https://<your-site>/api/alerts/setup?key=<CRON_SECRET>` once. It should answer with your bot's name.
5. **Start the 5-minute check.** Sign up at [cron-job.org](https://cron-job.org) and add a job that opens `https://<your-site>/api/alerts/check?key=<CRON_SECRET>` every 5 minutes.

`/api/health` then shows an `alerts` line. If the 5-minute check stops running, it turns red there within 15 minutes.

## What's in this folder

```
app/                    the web pages and their backend routes
lib/kamino/             reads Kamino's lending market and works out each loan's breaking point
lib/alerts/             the Telegram alerts: when to warn, what to say, who's subscribed
lib/marketData/         live prices from Jupiter + Yahoo (or Pyth, when available)
lib/pyth/               the Pyth integration, built and ready
lib/prestocks/          pre-IPO prices, with a fallback for PreStocks outages
lib/meteora/            the Gap Insurance pool, quoting and payout logic
lib/solana/             reads a wallet's tokenized-stock holdings
lib/stocks/             the 8 stocks GapGuard tracks
scripts/                one-off setup and settlement scripts
scripts/devnet/         free test-network versions of those scripts
docs/submission.md      the full write-up for hackathon judges
```

## Where things stand

Live and working end to end:

1. Risk checks and Telegram warnings run on real Kamino loans, checked every 5 minutes. [`/api/health`](https://gapguard-alpha.vercel.app/api/health) shows, at any moment, whether prices, the pre-IPO feed, both insurance pools and the alert checks are all working.
2. Gap Insurance has a real buy, settlement and payout flow, proven with on-chain transactions listed in docs/submission.md. Settlement is run by a person with a script, and payouts come from a wallet the builder controls rather than an audited contract. That's why it's a demo, and we say so.

GapGuard started as a hackathon project. It's being built into a free tool that people with real money on the line can rely on.
