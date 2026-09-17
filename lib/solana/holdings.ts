import { Connection, PublicKey } from "@solana/web3.js";
import { CURATED_STOCKS } from "../stocks/curatedList";

/** xStocks are Token-2022 mints (confirmed via Jupiter's token records, which
 * list `tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"` for all
 * of them — that's the Token-2022 program's real address, not classic SPL
 * Token). Reading a wallet's SPL balances with the wrong program ID
 * silently returns zero accounts, not an error, so this matters. */
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

export type Holding = {
  ticker: string;
  name: string;
  xstockSymbol: string;
  mint: string;
  amountTokens: number;
};

/**
 * Reads a wallet's balances for the curated xStock mints only. This is a
 * plain, free, permissionless RPC read — no API key, no paid tier, works
 * forever as long as Solana RPC exists.
 */
export async function fetchXStockHoldings(
  connection: Connection,
  wallet: PublicKey
): Promise<Holding[]> {
  const { value: accounts } = await connection.getParsedTokenAccountsByOwner(
    wallet,
    { programId: TOKEN_2022_PROGRAM_ID }
  );

  const byMint = new Map<string, number>();
  for (const { account } of accounts) {
    const info = account.data.parsed?.info;
    const mint: string | undefined = info?.mint;
    const uiAmount: number | undefined = info?.tokenAmount?.uiAmount;
    if (mint && uiAmount && uiAmount > 0) {
      byMint.set(mint, (byMint.get(mint) ?? 0) + uiAmount);
    }
  }

  const holdings: Holding[] = [];
  for (const stock of CURATED_STOCKS) {
    const amountTokens = byMint.get(stock.mint);
    if (amountTokens) {
      holdings.push({
        ticker: stock.ticker,
        name: stock.name,
        xstockSymbol: stock.xstockSymbol,
        mint: stock.mint,
        amountTokens,
      });
    }
  }

  return holdings;
}
