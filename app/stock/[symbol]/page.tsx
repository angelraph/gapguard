import Link from "next/link";
import { notFound } from "next/navigation";
import { CURATED_STOCKS } from "@/lib/stocks/curatedList";

/**
 * Per-stock drilldown (day 3 build target). The history chart wires up
 * once the cron snapshot + datastore from day 2 is recording data. For
 * now this shows the stock's identity and points back to the Radar table,
 * which already has the live numbers.
 */
export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const stock = CURATED_STOCKS.find(
    (s) => s.ticker.toLowerCase() === symbol.toLowerCase()
  );
  if (!stock) notFound();

  return (
    <div className="flex flex-1 flex-col bg-bg-primary text-text-primary">
      <header className="border-b border-border px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Link href="/" className="text-sm text-text-secondary hover:text-solana-purple">
            ← GapGuard
          </Link>
          <h1 className="text-lg font-semibold">
            {stock.ticker} · {stock.name}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        <p className="text-text-secondary">
          On-chain token: <span className="font-mono text-text-primary">{stock.xstockSymbol}</span>
        </p>
        <div className="mt-6 border border-dashed border-border p-4 text-sm text-text-muted">
          A price history chart for this stock is coming soon. For live
          numbers right now, go back to the{" "}
          <Link href="/" className="text-solana-purple underline">
            home page
          </Link>
          .
        </div>
      </main>
    </div>
  );
}
