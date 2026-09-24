import { Connection, PublicKey } from "@solana/web3.js";
import type { SettlementResult } from "./settlement";

/**
 * Reads back the settlement record scripts/devnet/settle-window.js wrote
 * on-chain as a Memo instruction. A Memo transaction is independently
 * verifiable by anyone on an explorer without trusting this app at all.
 *
 * The RPC's signature list already includes each transaction's memo text
 * (formatted "[length] text"), so this is a single RPC call. An earlier
 * version fetched every transaction one by one and got rate-limited by the
 * free public devnet RPC on every page load.
 */
export async function findLatestSettlement(
  connection: Connection,
  treasuryAddress: string,
  ticker: string,
  windowLabel: string,
  searchLimit = 100
): Promise<SettlementResult | null> {
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(treasuryAddress),
    { limit: searchLimit }
  );

  for (const info of signatures) {
    if (!info.memo) continue;
    const text = info.memo.replace(/^\[\d+\]\s/, "");
    try {
      const result: SettlementResult = JSON.parse(text);
      if (result.ticker === ticker && result.windowLabel === windowLabel) {
        return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}
