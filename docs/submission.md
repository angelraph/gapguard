# GapGuard, explained fully

## The problem

You can trade tokenized stocks like Apple or Tesla on Solana any time, day or night. The real stock market is only open certain hours. When the real market is closed, the token keeps trading, but there's no system checking whether its price still matches reality. If a stock gaps up or down overnight, everyone holding the token, or using it as collateral for a loan, gets no warning.

This already matters at real scale. Kamino, the biggest lending platform using these tokens, prices them using its own price feed with no check against what happens when the real market opens or closes. GapGuard fills that gap.

## What GapGuard does

1. **The Radar** (`/`). A public page showing, live, how far each tracked stock's token price has drifted from its real-world price. It also shows how old the real-market price is, since that number freezes while the market is closed and the token keeps moving. This was designed to run on Pyth's price feeds, and the Pyth integration is fully built (see below for why it isn't live yet); right now it runs on two other free, live, no-signup sources instead: Jupiter for the token's real trading price, and Yahoo Finance for the real stock's price. The page always tells you, in plain sight, which source is currently live.
2. **Your risk** (`/portfolio`). Connect a wallet and it reads your actual tokenized-stock holdings straight from the chain, values them at the live price, and lets you drag a slider to see what a price jump of any size would do to them — and, if you have a loan against these stocks on Kamino, how close that would put you to losing your collateral.
3. **Gap Insurance** (`/protect`). A small, single test market: pick one stock and one weekend, pay a small fee up front for "protection," and if the stock's price jumps more than an agreed amount by Monday, you get paid back from the pool. If it doesn't jump, the pool keeps the fee. Built on a Meteora Dynamic Bonding Curve pool, checked against real price data. This page is live right now against a real pool on Solana's devnet (a free test network) — you can connect a wallet, get a real quote, and see the buy flow work today, at zero cost. Every step of the mechanism, including settlement and payout, was run for real and confirmed working first (see below for the transaction links). Moving this same pool to the real network is a small, one-time cost (a few dollars of Solana rent) that the project owner can choose to spend once funded — the code is identical either way, only the network changes.

## What's automatic and what isn't, told plainly

We'd rather say this clearly than have a judge find out later.

- **Fully automatic, live, on-chain:** the price feeds, the fee collection into the insurance pool, and the math that decides whether a jump counts as a "gap."
- **Needs a person to press a button:** deciding when the settlement window has ended and running a script to check the final price and record the result on-chain. This is not a fully automatic, trustless system yet. It is checked against real Pyth price data and the result is written on-chain so anyone can verify it, but a person triggers it.
- **Not a bank-grade vault:** paying people back right now happens from a wallet the builder controls, not from a smart contract that holds funds in escrow. Building that properly is real work for after the hackathon, listed below.

We're not hiding any of this. A solo build in nine days means picking what to build well and being upfront about the rest.

## Why build this on Solana

Tokenized stocks trading 24/7 is what creates this problem in the first place, and it only exists because Solana settles trades in under a second, all day, every day. Pyth's price feeds, Meteora's pool tools, and Kamino's lending market are all things this project builds on top of instead of reinventing.

## What's next, not built yet

- **PreStocks and Tessera** (pre-IPO tokens like access to SpaceX or OpenAI). These don't have any public, continuous price at all, which is an even bigger version of the same problem GapGuard solves. The same idea could extend there.
- **Clawpump.** A stock-paired liquidity pool for the protection token itself would be a natural way to grow this after the hackathon.
- **A real escrow contract.** Replacing the builder-controlled payout wallet with an audited, trustless one, and replacing the person-triggered settlement with an automatic one.

## An honest problem we hit, and how we're handling it

Pyth's price data for real stocks (and for the on-chain tokenized versions) sits behind a paid plan that costs $5,000 to $10,000 a month. A free hackathon key does not include it. We found this out by testing directly, not by guessing: the key works for major crypto prices like Bitcoin, but returns "not entitled" for the stock feeds this whole project depends on.

We asked Pyth about this directly. Their answer: there's no informal builder grant for hackathon participants — the only route to this data is their paid sales form, starting at the pricing above. That settles the question: GapGuard runs on free data as its real, permanent choice, not a stopgap.

The Pyth integration is still fully built and left in place (it's one line to turn on: set `MARKET_DATA_SOURCE=pyth` in `.env.local`, see `lib/marketData/index.ts`), in case that ever changes. But the live app runs on two other sources that are free forever, need no signup, and are genuinely live, not recorded: Jupiter's public token API for the real price people are trading the token at, and Yahoo Finance's public stock quote for the real-world price. The site always shows which of the two is currently powering it, in plain text, right on the page.

## Data sources, checked live on 2026-09-16 and 2026-09-17

- Pyth's price feed list: `https://hermes.pyth.network/v2/price_feeds?query=<TICKER>` (free, no key needed, just for looking up feed IDs).
- Pyth's live price data: `https://hermes.pyth.network/v2/updates/price/latest` (needs a paid-tier key, see above).
- Jupiter's token price lookup: `https://lite-api.jup.ag/tokens/v2/search?query=<mint address>` (free, no key). We always look up by the exact, verified mint address, never by symbol, since several fake copycat tokens share the same symbol as the real xStocks.
- Yahoo Finance's stock quote: `https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>` (free, no key, unofficial but widely used).
- Kamino's xStocks lending market address: `5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua`, found through Kamino's own public markets list.
- Meteora's Dynamic Bonding Curve SDK: `@meteora-ag/dynamic-bonding-curve-sdk`.

## A naming mix-up we caught along the way

Kamino's own press coverage calls the Apple token "APPLx". The real token, verified directly against Jupiter's live data, is actually named "AAPLx" (matching the real ticker, AAPL). We checked this by looking up the real mint address rather than trusting a symbol, and we match everything in the code by mint address for exactly this reason.

## The devnet test run, in full

On 2026-09-17, every step of Gap Insurance was run for real on Solana's devnet (a free test network — no real money involved) and confirmed working, not just written and assumed correct:

1. **Pool created**: a real Meteora DBC pool went live on-chain. [Transaction](https://explorer.solana.com/tx/4BQQeQqjnbbc2beFXwfdPunmhfBPsQJRfWsg84iNqmzZxBytanZPE3Y4F3G2tjty2sUd1AtpUZyqnBV5VJFzCh6?cluster=devnet)
2. **Protection bought**: a real quote was fetched and a real swap executed against that pool. [Transaction](https://explorer.solana.com/tx/2yZQUx1cMwhUFutGy6BQjD7k5QX4uK1JPY9NcFEBxX8hySNL7bxWnSEsrU3xKrocVhuZ9jtXB9e8M13QJcRFeZjc?cluster=devnet)
3. **Settlement recorded**: checked against a real, live TSLA price pulled at that moment, written on-chain as a verifiable record. [Transaction](https://explorer.solana.com/tx/4G5cyT1JDBypuYRoJ8AaZDe4sD9RXVU5Qfe5HW4FkApparPJ2HyCeRo6VNyT6ZA37F3cPMWYd36xAKkZKQduR2f6?cluster=devnet)
4. **Settlement read back**: the app's own settlement-reading code found and correctly parsed that record — this caught a real bug (an RPC quirk in how the Memo program's data comes back) that's now fixed.
5. **Payout sent**: a real transfer back to a holder, proving the pay-back step works. [Transaction](https://explorer.solana.com/tx/2d69pDFbwsgJ9qd5mgAcrUGukp8s4vzrZB7u2eQob2aqNBgaDRj4PNf5P4iRm8QEYX4octPnQPXsMpWcZRoup8S6?cluster=devnet)

This run also caught and fixed several real, undocumented quirks in Meteora's SDK: the curve math needs the migration target set as a market-cap ratio rather than a raw number (a raw "very high" number broke in ways that weren't obvious from the docs), the liquidity-split percentages must add up to 100 with at least 10% locked (an anti-rug-pull rule), and token names are capped at 32 characters. All of these are now fixed in the actual code that would run on the real network, not just in the test scripts.
