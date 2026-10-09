import type { LoanRisk } from "@/lib/kamino/portfolio";

const SAFE_DROP = 0.25;

function usd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

const KIND_LABEL: Record<LoanRisk["kind"], string> = {
  standard: "Loan",
  multiply: "Multiply position",
  leverage: "Leverage position",
  other: "Position",
};

/**
 * One Kamino loan, said plainly: how far the stocks can fall before it can
 * be liquidated, and what would make it safe again.
 */
export function LoanCard({ loan, alertsHref }: { loan: LoanRisk; alertsHref: string | null }) {
  const drop = loan.dropToLiquidation;
  const tone =
    drop === null ? "text-text-secondary" : drop < 0.1 ? "text-amber-300" : drop < SAFE_DROP ? "text-sky" : "text-mint";

  return (
    <div className="glass p-5 sm:p-6">
      <p className="text-xs uppercase tracking-wide text-text-muted">{KIND_LABEL[loan.kind]} on Kamino</p>

      {drop === null ? (
        <p className="mt-2 text-lg font-semibold">
          {loan.note === "stock-debt"
            ? "This loan borrows stock tokens, so a price rise is the risk. GapGuard doesn't track that yet."
            : loan.note === "no-stock-risk"
              ? "Even if its stocks went to zero, this loan wouldn't be liquidated."
              : "Deposits only, no loan, so nothing can be liquidated."}
        </p>
      ) : drop <= 0 ? (
        <p className={`mt-2 text-lg font-semibold ${tone}`}>This loan can be liquidated right now.</p>
      ) : (
        <p className="mt-2 text-lg font-semibold">
          Survives a drop of up to <span className={`font-mono ${tone}`}>{pct(drop)}</span> in its stocks.
        </p>
      )}
      {drop !== null && drop > 0 && (
        <p className="mt-1 text-sm text-text-secondary">
          A bigger drop and Kamino can liquidate it, selling part of the collateral at a discount to repay
          the loan.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4 text-sm">
        <div>
          <p className="text-xs text-text-muted">Borrowed</p>
          <p className="mt-1 font-mono tabular-nums">{usd(loan.borrowedUsd)}</p>
          <p className="mt-1 text-xs text-text-muted">{loan.borrows.map((b) => b.symbol).join(", ") || "none"}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Collateral</p>
          <p className="mt-1 font-mono tabular-nums">{usd(loan.depositedUsd)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {loan.deposits
              .filter((d) => d.valueUsd >= 0.01)
              .map((d) => d.symbol)
              .join(", ")}
          </p>
        </div>
      </div>

      {drop !== null && drop < SAFE_DROP && (loan.repayToSafeUsd >= 1 || loan.addToSafeUsd >= 1) && (
        <p className="mt-4 border-t border-white/[0.06] pt-4 text-sm text-text-secondary">
          To get back to a safe {SAFE_DROP * 100}% cushion, repay about{" "}
          <span className="font-mono text-text-primary">{usd(loan.repayToSafeUsd)}</span> or add about{" "}
          <span className="font-mono text-text-primary">{usd(loan.addToSafeUsd)}</span> more of the stock
          tokens as collateral, on{" "}
          <a href="https://app.kamino.finance" target="_blank" rel="noreferrer" className="underline">
            Kamino
          </a>
          .
        </p>
      )}

      {alertsHref && drop !== null && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
          <a href={alertsHref} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-2 !text-sm">
            Get free Telegram alerts
          </a>
          <p className="text-xs text-text-muted">
            A message on Friday before the weekend, and whenever this cushion gets thin. Read-only.
          </p>
        </div>
      )}
    </div>
  );
}
