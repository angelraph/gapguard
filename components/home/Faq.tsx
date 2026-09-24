const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "What is a “gap”?",
    a: "It is the distance between a token's price and the price it is supposed to track. For a tokenized stock that means the real stock's price. For a pre-IPO token it means the issuer's own mark. A big gap means the two disagree, and someone is about to be surprised.",
  },
  {
    q: "Why does a gap appear when the market is closed?",
    a: "The real stock only trades about 32 hours a week. The token on Solana trades all 168. Once the real market closes, its price stops moving while the token keeps going, so they drift apart until the market reopens and the real price jumps to catch up.",
  },
  {
    q: "Where do the prices come from?",
    a: "Tokenized stocks are read from Pyth: the real stock feed and the on-chain xStock feed side by side. If Pyth ever fails, GapGuard switches to Jupiter and Yahoo Finance and tells you on the page. Pre-IPO prices come from PreStocks' public API.",
  },
  {
    q: "How does Gap Insurance work?",
    a: "You pay a small fee and receive protection tokens for one stock and one weekend. If the price at Monday's open is more than 3% away from Friday's close, protection holders are paid back. If not, the pool keeps the fees. The tokens are sold on a Meteora bonding curve.",
  },
  {
    q: "Who decides whether it pays out?",
    a: "Pyth's prices do. After a window ends, a script reads Friday's close and Monday's open from Pyth and writes them, with the exact timestamps, into a Solana transaction, so anyone can re-check the result. A person still runs that script today. Making it permissionless is the next thing to build.",
  },
  {
    q: "Is it safe? Is it audited?",
    a: "No, it is not audited. It is a hackathon project. Payouts come from a wallet the builder controls rather than an escrow contract. That is why the mainnet page tells you to buy only what you are happy to risk, and why there is a free devnet version.",
  },
  {
    q: "Can I lose money?",
    a: "Yes. Protection is insurance: if the price does not move more than 3%, the fee you paid is not returned. Only buy what you would be fine paying for that peace of mind.",
  },
  {
    q: "Do I need real money to try it?",
    a: "No. Pick the Devnet tab on Gap Insurance. It uses a free test network with a free test USDC button, so you can run the whole flow, from quote to buy, at no cost.",
  },
  {
    q: "Why does my wallet need to match the network?",
    a: "A website cannot change the network inside your wallet, on purpose, for your safety. If you pick Devnet on the page, set your wallet to Devnet too. In Phantom that is Settings, Developer Settings, Change Network.",
  },
  {
    q: "What is a pre-IPO “mark”?",
    a: "Private companies like OpenAI and SpaceX have no public price. The token issuer publishes its own estimate, the mark, and updates it now and then. The token itself trades freely in between, so it can sit far above or below the mark until the next update.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-bg-card">
      {QUESTIONS.map((item) => (
        <details key={item.q} className="group px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.98rem] font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-text-secondary transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-3 max-w-3xl text-[0.95rem] leading-relaxed text-text-secondary">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
