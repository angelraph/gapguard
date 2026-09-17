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
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-50">
            ← GapGuard
          </Link>
          <h1 className="text-lg font-semibold">
            {stock.ticker} · {stock.name}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-10 sm:py-10">
        <p className="text-zinc-400">
          On-chain token: <span className="text-zinc-200">{stock.xstockSymbol}</span>
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
          A price history chart for this stock is coming soon. For live
          numbers right now, go back to the{" "}
          <Link href="/" className="underline">
            home page
          </Link>
          .
        </div>
      </main>
    </div>
  );
}
