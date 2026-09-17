import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROTECTION_MARKET } from "./dbcPool";

/**
 * Settlement design (see docs/submission.md for the full, honest writeup):
 *
 *  - Pyth price reads: fully automated, live.
 *  - Trigger: a human runs `scripts/settle-window.ts` at the window's end.
 *    This is NOT a permissionless on-chain crank — say so explicitly.
 *  - Record: the computed outcome is written on-chain via the Solana Memo
 *    program (no custom program needed) so the *result* is independently
 *    verifiable on any explorer, even though the *trigger* was a script.
 *  - Payout: a backend-executed SPL transfer from a treasury keypair (or a
 *    Squads multisig, if there's time to wire one up) to each protection
 *    token holder. This is a custodial payout for demo purposes — GapGuard
 *    is not shipping an audited escrow/vault program in 9 days, and the
 *    README says so plainly rather than implying otherwise.
 */

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export type SettlementResult = {
  ticker: string;
  windowLabel: string;
  closePrice: number;
  reopenPrice: number;
  gapBps: number;
  thresholdBps: number;
  triggered: boolean;
  payoutPerTokenUsd: number;
  settledAtIso: string;
};

export function computeSettlement(
  closePrice: number,
  reopenPrice: number,
  poolUsdcBalance: number,
  outstandingProtectionTokens: number
): SettlementResult {
  const gapBps = Math.round(
    (Math.abs(reopenPrice - closePrice) / closePrice) * 10_000
  );
  const triggered = gapBps >= PROTECTION_MARKET.gapThresholdBps;

  const payoutPerTokenUsd =
    triggered && outstandingProtectionTokens > 0
      ? poolUsdcBalance / outstandingProtectionTokens
      : 0;

  return {
    ticker: PROTECTION_MARKET.ticker,
    windowLabel: PROTECTION_MARKET.windowLabel,
    closePrice,
    reopenPrice,
    gapBps,
    thresholdBps: PROTECTION_MARKET.gapThresholdBps,
    triggered,
    payoutPerTokenUsd,
    settledAtIso: new Date().toISOString(),
  };
}

/**
 * Write the settlement result on-chain as a Memo instruction, signed by the
 * builder's treasury keypair. This is the "Pyth-verified, on-chain-recorded"
 * half of the honesty framing — anyone can pull this transaction up on an
 * explorer and see exactly what data the payout decision was based on.
 */
export async function recordSettlementOnChain(
  connection: Connection,
  payer: Keypair,
  result: SettlementResult
): Promise<string> {
  const memoText = JSON.stringify(result);
  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf-8"),
  });

  const tx = new Transaction().add(instruction);
  const signature = await connection.sendTransaction(tx, [payer]);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
