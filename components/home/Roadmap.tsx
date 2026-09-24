type Milestone = {
  status: "shipped" | "next" | "later";
  title: string;
  points: string[];
};

const MILESTONES: Milestone[] = [
  {
    status: "shipped",
    title: "The hackathon build, live today",
    points: [
      "Radar on Pyth for 8 tokenized stocks, with an automatic fallback source",
      "Pre-IPO gaps from PreStocks, shown against each issuer's mark",
      "Your risk: holdings read from the chain, plus a Kamino liquidation projection",
      "Gap Insurance on a Meteora bonding curve, proven end to end on devnet",
      "A real mainnet pool with real USDC, and a free devnet copy with a faucet",
      "Settlement from Pyth's prices, with the exact timestamps recorded on-chain",
    ],
  },
  {
    status: "next",
    title: "Take the trust out of me",
    points: [
      "Settlement that anyone can trigger once a window ends, not just a script I run",
      "An escrow contract that holds payouts, instead of a wallet I control",
      "Test Your risk against real Kamino borrowers, not just the SDK's own examples",
      "Price history and alerts, so you hear about a widening gap before it lands",
    ],
  },
  {
    status: "later",
    title: "A market, not a demo",
    points: [
      "More stocks and rolling weekly windows, not one Tesla weekend",
      "Protection sold by liquidity providers, so anyone can underwrite a gap",
      "Protection for pre-IPO tokens, where the gap never closes",
      "An independent security audit before real volume",
    ],
  },
];

const STATUS_LABEL: Record<Milestone["status"], string> = {
  shipped: "Shipped",
  next: "Building next",
  later: "Later",
};

export function Roadmap() {
  return (
    <ol className="relative space-y-6 border-l border-white/10 pl-6 sm:pl-8">
      {MILESTONES.map((m) => (
        <li key={m.title} className="relative">
          <span
            aria-hidden
            className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full sm:-left-[39px] ${
              m.status === "shipped"
                ? "bg-mint shadow-[0_0_0_4px_rgba(184,245,107,0.15)]"
                : m.status === "next"
                ? "bg-sky"
                : "border border-white/30 bg-bg-primary"
            }`}
          />
          <div className="glass p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] ${
                  m.status === "shipped"
                    ? "bg-mint/15 text-mint"
                    : m.status === "next"
                    ? "bg-sky/15 text-sky"
                    : "bg-white/10 text-text-secondary"
                }`}
              >
                {STATUS_LABEL[m.status]}
              </span>
              <h3 className="text-lg font-semibold">{m.title}</h3>
            </div>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[0.95rem] text-text-secondary sm:grid-cols-2">
              {m.points.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
