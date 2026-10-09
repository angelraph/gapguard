import { SAFE_DROP, type LoanRisk } from "../kamino/portfolio";
import type { AlertState } from "./store";

/**
 * When to message someone and what to say. Kept free of network calls so
 * the rules can be tested on their own.
 *
 * Warning levels: a message when the room left before liquidation falls
 * under 15%, then 10%, then 5%, then 0 (can be liquidated now). Each level
 * is sent once. A level re-arms only after the cushion recovers by 3 points,
 * so a price hovering around a line doesn't send a stream of messages.
 */

export const WARNING_LEVELS = [0.15, 0.1, 0.05, 0] as const;
const REARM_MARGIN = 0.03;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://gapguard-alpha.vercel.app").replace(/\/$/, "");
export const KAMINO_URL = "https://app.kamino.finance";

export type Clock = { weekday: string; minutes: number; date: string };

/** The level a cushion sits in, or null when it's above 15%. */
export function levelFor(drop: number): number | null {
  if (drop <= 0) return 0;
  for (const level of [0.05, 0.1, 0.15]) if (drop < level) return level;
  return null;
}

export function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

/** The loan closest to liquidation, among those that can be liquidated by a stock drop. */
export function riskiestLoan(loans: LoanRisk[]): (LoanRisk & { dropToLiquidation: number }) | null {
  const atRisk = loans.filter((l): l is LoanRisk & { dropToLiquidation: number } => l.dropToLiquidation !== null);
  atRisk.sort((a, b) => a.dropToLiquidation - b.dropToLiquidation);
  return atRisk[0] ?? null;
}

function links(wallet: string): string {
  return `<a href="${KAMINO_URL}">Open Kamino</a> · <a href="${SITE_URL}/portfolio?wallet=${wallet}">See it on GapGuard</a>`;
}

function fixLine(loan: LoanRisk): string {
  if (loan.repayToSafeUsd < 1 && loan.addToSafeUsd < 1) return "";
  return `\nTo get back to a safe ${SAFE_DROP * 100}% cushion, repay about <b>${usd(loan.repayToSafeUsd)}</b> or add about <b>${usd(loan.addToSafeUsd)}</b> more of your stock tokens as collateral.`;
}

function loanLine(loan: LoanRisk): string {
  return `You borrowed ${usd(loan.borrowedUsd)} against ${usd(loan.depositedUsd)} of collateral.`;
}

/** A plain status for one wallet, used for /status and right after someone subscribes. */
export function statusMessage(wallet: string, loans: LoanRisk[]): string {
  const head = `<b>Wallet ${shortWallet(wallet)}</b>`;
  const loan = riskiestLoan(loans);
  if (!loan) {
    if (loans.some((l) => l.note === "stock-debt")) {
      return `${head}\nThis loan borrows stock tokens, so the risk is their price going up, not down. GapGuard doesn't track that kind of loan yet, so I can't warn you about it. Keep an eye on it on Kamino.`;
    }
    if (loans.some((l) => l.note === "no-stock-risk")) {
      return `${head}\nYou have a loan on Kamino's xStocks market, but most of its collateral isn't stocks. Even if your stocks went to zero, it wouldn't be liquidated. Nothing to warn you about.`;
    }
    return `${head}\nNo loan on Kamino's xStocks market right now, so there's nothing that can be liquidated. I'll keep watching and tell you if that changes.`;
  }
  if (loan.dropToLiquidation <= 0) {
    return `${head}\n<b>This loan can be liquidated right now.</b>\n${loanLine(loan)}${fixLine(loan)}\n\n${links(wallet)}`;
  }
  const safe = loan.dropToLiquidation >= SAFE_DROP;
  return (
    `${head}\nYour loan survives a drop of up to <b>${pct(loan.dropToLiquidation)}</b> in your stocks. A bigger drop and Kamino can liquidate it, selling part of your collateral at a discount.\n` +
    `${loanLine(loan)}` +
    (safe ? "\nThat's a comfortable cushion." : fixLine(loan)) +
    `\n\n${links(wallet)}`
  );
}

function warningMessage(wallet: string, loan: LoanRisk & { dropToLiquidation: number }): string {
  const head =
    loan.dropToLiquidation <= 0
      ? `<b>Your Kamino loan can be liquidated right now</b>`
      : `<b>Your Kamino loan is getting close to liquidation</b>`;
  const body =
    loan.dropToLiquidation <= 0
      ? `Its collateral has fallen to the point where Kamino can sell part of it at a discount to repay the loan.`
      : `If your stocks fall another <b>${pct(loan.dropToLiquidation)}</b>, Kamino can liquidate this loan and sell part of your collateral at a discount.`;
  return `${head}\nWallet ${shortWallet(wallet)}\n${body}\n${loanLine(loan)}${fixLine(loan)}\n\n${links(wallet)}`;
}

function fridayMessage(wallet: string, loan: LoanRisk & { dropToLiquidation: number }): string {
  const safe = loan.dropToLiquidation >= SAFE_DROP;
  return (
    `<b>The stock market closes for the weekend at 4pm New York time</b>\n` +
    `Wallet ${shortWallet(wallet)}\n` +
    `Your loan survives a drop of up to <b>${pct(loan.dropToLiquidation)}</b> in your stocks. Until Monday's open, the token keeps trading while the real market is shut, and Monday can open with a jump.\n` +
    (safe
      ? `That's a comfortable cushion. I'll message you if it shrinks over the weekend.`
      : `Weekend moves that size do happen.${fixLine(loan)}`) +
    `\n\n${links(wallet)}`
  );
}

function mondayMessage(wallet: string, loan: LoanRisk & { dropToLiquidation: number }): string {
  return (
    `<b>The stock market opens in under an hour</b>\n` +
    `Wallet ${shortWallet(wallet)}\n` +
    `Right now your loan survives a drop of up to <b>${pct(loan.dropToLiquidation)}</b>. When the market opens, the token catches up with the real stock price, sometimes all at once.` +
    (loan.dropToLiquidation >= SAFE_DROP ? "" : fixLine(loan)) +
    `\n\n${links(wallet)}`
  );
}

function goneMessage(wallet: string): string {
  return (
    `<b>I no longer see a loan for wallet ${shortWallet(wallet)}</b>\n` +
    `It was either repaid or liquidated. You can check your history on Kamino. I'll keep watching this wallet in case you borrow again.\n\n${links(wallet)}`
  );
}

/** Decide what (if anything) to send for one wallet, and the state to remember. */
export function planAlerts(
  wallet: string,
  loans: LoanRisk[],
  previous: AlertState,
  clock: Clock
): { messages: string[]; state: AlertState } {
  const messages: string[] = [];
  const state: AlertState = { ...previous };
  const loan = riskiestLoan(loans);

  // Loan disappeared: wait for two checks in a row, so one odd read can't cause a false message.
  if (!loan) {
    // Still a loan, just not one a stock drop can liquidate: nothing to say.
    if (loans.some((l) => l.borrowedUsd >= 0.01)) {
      state.hadLoan = true;
      state.missing = 0;
      state.level = null;
      return { messages, state };
    }
    if (state.hadLoan) {
      state.missing = (state.missing ?? 0) + 1;
      if (state.missing >= 2) {
        messages.push(goneMessage(wallet));
        state.hadLoan = false;
        state.missing = 0;
        state.level = null;
      }
    }
    return { messages, state };
  }
  state.hadLoan = true;
  state.missing = 0;

  // Warning levels.
  const level = levelFor(loan.dropToLiquidation);
  if (state.level !== null && loan.dropToLiquidation > state.level + REARM_MARGIN) {
    state.level = level;
  }
  let warned = false;
  if (level !== null && (state.level === null || level < state.level)) {
    messages.push(warningMessage(wallet, loan));
    state.level = level;
    warned = true;
  }

  // Friday heads-up, 3pm to 4pm New York time. Skipped if a warning just went out.
  if (clock.weekday === "Fri" && clock.minutes >= 15 * 60 && clock.minutes < 16 * 60 && state.friday !== clock.date) {
    state.friday = clock.date;
    if (!warned) messages.push(fridayMessage(wallet, loan));
  }

  // Monday, the hour before the open.
  if (clock.weekday === "Mon" && clock.minutes >= 8 * 60 + 30 && clock.minutes < 9 * 60 + 30 && state.monday !== clock.date) {
    state.monday = clock.date;
    if (!warned) messages.push(mondayMessage(wallet, loan));
  }

  return { messages, state };
}
