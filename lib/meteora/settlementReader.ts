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
 *
 * Verified end-to-end on devnet on 2026-09-17: a real settlement was
 * written and read back successfully. That test caught a real bug in an
 * earlier version of this function — `getParsedTransaction` recognizes
 * the Memo program (`spl-memo`) and auto-decodes its instruction into a
 * `parsed` field containing the plain UTF-8 text directly, NOT the raw
 * base58 `data` field this function originally checked for exclusively.
 * Handling both shapes below, since which one an RPC returns isn't
 * guaranteed to be consistent across providers/versions.
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

      let text: string;
      if ("parsed" in ix && typeof ix.parsed === "string") {
        // Already plain text — this is what a real RPC actually returns
        // for the Memo program (confirmed by testing).
        text = ix.parsed;
      } else if ("data" in ix && typeof ix.data === "string") {
        // Fallback for an RPC that returns it undecoded instead.
        text = Buffer.from(bs58.decode(ix.data)).toString("utf-8");
      } else {
        continue;
      }

      try {
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
