# GapGuard, explained fully

## The problem

You can trade tokenized stocks like Apple or Tesla on Solana any time, day or night. The real stock market is only open certain hours. When it is closed, the token keeps trading, but nothing checks whether its price still matches reality. If a stock gaps up or down overnight, everyone holding the token, or using it as collateral for a loan, gets no warning.

This already matters at real scale. Kamino's tokenized stock lending market holds more than $21 million of these tokens as collateral right now. And pre-IPO tokens (OpenAI, SpaceX, Anthropic) have the same problem in a permanent form: the company is private, so there is never a live real price at all, only the issuer's occasional mark. Today OpenAI's token trades 31% above its issuer mark and SpaceX's trades 20% below.

GapGuard is the risk layer for that gap: it shows it, lets you see what it would do to your holdings, and lets you insure against it.

## What GapGuard does

1. **The Radar** (`/`). A public page showing, live, how far each tokenized stock's on-chain price sits from the real stock's price, how old the real price is, and whether the market is open. Built on Pyth: the real stock feed (`Equity.US.<TICKER>/USD`) against the on-chain xStock feed (`Crypto.<TICKER>X/USD`). Below it, the same idea for pre-IPO tokens: PreStocks publishes an issuer mark and the live on-chain price for each, and the Radar shows the gap between them.
2. **Your risk** (`/portfolio`). Connect a wallet and it reads your tokenized stock and pre-IPO holdings straight from the chain, values them live, and lets you drag a slider to see what a price jump of any size would do, including how close a Kamino loan would come to liquidation.
3. **Gap Insurance** (`/protect`). Pick one stock and one weekend, pay a small fee up front, and if the price moves more than 3% between Friday's close and Monday's open, holders are paid back. If not, the pool keeps the fee. Built on a Meteora Dynamic Bonding Curve pool. It runs on two networks side by side, chosen with a switch on the page: **mainnet** with real USDC, and **devnet**, a free test network with a free faucet, so anyone can try the whole flow at no cost.

## How this answers the judging question

The judges ask whether this could be a real app people actually use.

- **A real user and problem.** Anyone holding tokenized stocks over a weekend, and anyone lending against them. The exposure is measurable today: $21 million on Kamino.
- **A working end to end demo.** Every step runs for real: live prices, a wallet read, a quote, a buy, a settlement written on-chain, and a payout path. Transaction links are listed below.
- **Why it belongs on Solana.** The problem only exists because Solana trades these tokens around the clock. Pyth, Meteora and Kamino are all Solana native pieces this builds on instead of reinventing.
- **Quality of execution.** Mobile responsive, plain language throughout, honest about its limits, and it keeps working when a data source fails (see the automatic fallback below).

## The sponsor tracks

**Pyth.** Pyth is the price source the whole product stands on, not a decoration. The Radar compares Pyth's equity feed against Pyth's xStock feed for all 8 stocks, refreshed every 30 seconds. Gap Insurance settles from Pyth too: the settlement reads Friday's close and Monday's open from `Equity.US.TSLA/USD` at those exact moments (Pyth's price history lookup), and writes the price source and the exact Pyth publish times into the on-chain record so anyone can re-check them. If Pyth ever fails, the Radar falls back to Jupiter plus Yahoo Finance and says so on the page, so the site never goes dark.

**Meteora DBC.** A Dynamic Bonding Curve normally launches a memecoin. Here it is used as a transparent, on-chain sale curve for a protection token tied to one stock and one weekend, with USDC as the quote token, so premiums pool up in USDC in the pool itself. The configuration is deliberately unusual: migration is set 1,000 times above the starting market cap so it can never realistically trigger, 10% of liquidity is locked as the protocol requires, and the fee is a flat, visible 1%. It was tested end to end on devnet first, which found real undocumented behaviour in the SDK (listed further down). A mainnet pool of the same configuration is described in the mainnet section.

**PreStocks.** The Radar and Your risk both read PreStocks' public API. For each pre-IPO token it shows the issuer's mark against the live on-chain price, sorted by the size of the gap, and Your risk recognises PreStocks holdings alongside tokenized stocks. This is the same risk GapGuard tracks for public stocks, on assets that have no market hours at all.

**Tessera and Clawpump, deliberately not included.** PreStocks' rules make a project ineligible if it uses any other pre-IPO token, so adding Tessera would have cost the PreStocks bounty. Clawpump's bounty needs a separate agent token launched through Clawpump with a stock paired pool, which is a different product from this one. We chose depth over touching every logo.

## What's automatic and what isn't, told plainly

We would rather say this clearly than have a judge find out later.

- **Fully automatic, live, on-chain:** the price feeds, the fee collection into the pool, and the math that decides whether a move counts as a gap.
- **Needs a person to press a button:** deciding the window has ended and running the settlement script. It reads Pyth's prices and writes the result on-chain, so anyone can verify it, but a person triggers it. It is not a trustless, permissionless system yet.
- **Not a bank grade vault:** paying people back happens from a wallet the builder controls, not from a smart contract holding funds in escrow. Building that properly is real work after the hackathon.
- **Not audited.** This is a hackathon project. The mainnet page says so before you connect.

## What happened when we settled the first window

The devnet test window ran Friday Sep 18 4:00pm ET to Monday Sep 21 9:30am ET. From Pyth, Tesla's Friday close was $364.38 and Monday's open was $371.64, a move of 1.99%. That is under the 3% trigger, so nobody was paid, and the pool keeps the fees. That is the mechanism working as designed, and the result is recorded on-chain.

## An honest problem we hit, and how we handled it

For most of the build, Pyth's equity and xStock feeds returned "not entitled" on our key, because that data sits on a paid plan, and Pyth told us there was no informal builder grant. We did not fake anything. We built a swappable data layer, ran the Radar on two free live sources (Jupiter for the on-chain price, Yahoo Finance for the real price), and said so on the page. On Sep 24 the same key started returning both feeds, we verified all 22 feeds live, and switched the Radar and the settlement to Pyth. The free sources stayed as the automatic fallback.

## Devnet test run, in full

On Sep 17 every step of Gap Insurance was run for real on Solana's devnet and confirmed:

1. **Pool created.** [Transaction](https://explorer.solana.com/tx/4BQQeQqjnbbc2beFXwfdPunmhfBPsQJRfWsg84iNqmzZxBytanZPE3Y4F3G2tjty2sUd1AtpUZyqnBV5VJFzCh6?cluster=devnet)
2. **Protection bought.** [Transaction](https://explorer.solana.com/tx/2yZQUx1cMwhUFutGy6BQjD7k5QX4uK1JPY9NcFEBxX8hySNL7bxWnSEsrU3xKrocVhuZ9jtXB9e8M13QJcRFeZjc?cluster=devnet)
3. **Settlement recorded** against a live TSLA price. [Transaction](https://explorer.solana.com/tx/4G5cyT1JDBypuYRoJ8AaZDe4sD9RXVU5Qfe5HW4FkApparPJ2HyCeRo6VNyT6ZA37F3cPMWYd36xAKkZKQduR2f6?cluster=devnet)
4. **Settlement read back** by the app's own code, which caught and fixed a real RPC parsing bug.
5. **Payout sent** back to a holder. [Transaction](https://explorer.solana.com/tx/2d69pDFbwsgJ9qd5mgAcrUGukp8s4vzrZB7u2eQob2aqNBgaDRj4PNf5P4iRm8QEYX4octPnQPXsMpWcZRoup8S6?cluster=devnet)

This run found and fixed real undocumented behaviour in Meteora's SDK: the curve math needs the migration target as a market cap ratio rather than a raw number, the liquidity split must add to 100 with at least 10% locked, and token names are capped at 32 bytes. It also found that a wallet cannot be switched to another network by a website, which is why the page has a network switch and tells people to match their wallet.

## Data sources

- Pyth Hermes: `https://hermes.pyth.network/v2/updates/price/latest` for live prices and `https://hermes.pyth.network/v2/updates/price/<time>` for the settlement moments (key required).
- PreStocks: `https://prestocks.com/api/prestocks` (free, no key).
- Jupiter token API: `https://lite-api.jup.ag/tokens/v2/search?query=<mint>` (fallback and token lookups, always by exact mint address, since copycat tokens share symbols).
- Yahoo Finance chart API (fallback only).
- Kamino's xStocks lending market: `5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua`.
- Meteora Dynamic Bonding Curve SDK: `@meteora-ag/dynamic-bonding-curve-sdk`.

## A naming mix up we caught

Kamino's press coverage calls the Apple token "APPLx". The real token, verified against Jupiter by mint address, is "AAPLx". Everything in the code matches by mint address for that reason.

## What's next

- A real escrow contract, replacing the builder controlled payout wallet, and a permissionless settlement crank.
- More markets: more stocks, and pre-IPO tokens, where the gap is bigger and permanent.
- A pool of protection sold by liquidity providers instead of one curve.
