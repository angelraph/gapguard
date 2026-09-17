import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { MEMO_PROGRAM_ID, type SettlementResult } from "./settlement";

/**
 * Reads back the settlement record scripts/settle-window.ts wrote on-chain
 * as a Memo instruction (see lib/meteora/settlement.ts for why a Memo
 * instruction rather than a custom account: no new on-chain program is in
 * scope for this build, and a Memo transaction is independently verifiable
 * by anyone on an explorer without trusting this app at all).
 *
 * This is a plain, free RPC read — scans the treasury address's recent
 * transaction history for a Memo instruction whose JSON matches the given
 * ticker and window.
 */
export async function findLatestSettlement(
  connection: Connection,
  treasuryAddress: string,
  ticker: string,
  windowLabel: string,
  searchLimit = 50
): Promise<SettlementResult | null> {
  const treasury = new PublicKey(treasuryAddress);
  const signatures = await connection.getSignaturesForAddress(treasury, {
    limit: searchLimit,
  });

  for (const { signature } of signatures) {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) continue;

    for (const ix of tx.transaction.message.instructions) {
      if (ix.programId.toBase58() !== MEMO_PROGRAM_ID.toBase58()) continue;
      if (!("data" in ix)) continue;

      try {
        const text = Buffer.from(bs58.decode(ix.data)).toString("utf-8");
        const result: SettlementResult = JSON.parse(text);
        if (result.ticker === ticker && result.windowLabel === windowLabel) {
          return result;
        }
      } catch {
        // Not our memo format (or not JSON at all) — skip it.
        continue;
      }
    }
  }

  return null;
}
