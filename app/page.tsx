"use client";

import Link from "next/link";
import { ShockMap } from "@/components/ShockMap";
import { TickerTape, type TapeItem } from "@/components/home/TickerTape";
import { useMarketClock, useOverview, useRadarData } from "@/lib/useLiveData";
import { formatDuration, formatPct, formatUsdShort, minutesAgo } from "@/lib/format";

function Tile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  tone?: "default" | "warn" | "good";
}) {
  const valueColor = tone === "warn" ? "text-amber-300" : tone === "good" ? "text-mint" : "text-text-primary";
  return (
    <div className="glass flex flex-col justify-between p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums sm:text-[1.7rem] ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{sub}</p>
    </div>
  );
}

export default function CommandCenter() {
  const { data, preStocks } = useRadarData();
  const { overview } = useOverview();
  const clock = useMarketClock();

  // undefined while loading, null if Kamino couldn't be read.
  const census = overview ? overview.census : undefined;
  const tenPct = census?.rows.find((r) => r.drop === 0.1) ?? null;
  const widest = data?.stocks.length ? [...data.stocks].sort((a, b) => Math.abs(b.basis) - Math.abs(a.basis))[0] : null;
  const lastRun = overview?.alerts.lastRun ?? null;
  const alertsAgo = lastRun && clock ? minutesAgo(lastRun.at, clock.now) : null;
  const alertsRunning = alertsAgo !== null && alertsAgo <= 15;

  const tapeItems: TapeItem[] = [
    ...(data?.stocks ?? []).map((s) => ({ label: s.ticker, gap: s.basis })),
    ...(preStocks ?? []).map((p) => ({ label: p.symbol, gap: p.gap, note: "vs issuer mark" })),
  ];
  const topGaps = [...(data?.stocks ?? [])].sort((a, b) => Math.abs(b.basis) - Math.abs(a.basis)).slice(0, 5);

  return (
    <>
      <TickerTape items={tapeItems} />
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-8 sm:px-8">
        <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

        {/* Intro */}
        <section className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="eyebrow">Live command center</p>
            <h1 className="display mt-4 text-[2.4rem] leading-[1.05] sm:text-5xl lg:text-[3.6rem]">
              While the market sleeps, <span className="text-gradient">the price doesn&apos;t.</span>
            </h1>
            <p className="mt-4 max-w-xl text-text-secondary">
              Tokenized stocks trade all weekend. The real market doesn&apos;t. When it reopens, the token can jump in
              one move and liquidate the loans built on it. GapGuard shows you that risk live and warns you before
              Monday morning costs you money.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/portfolio" className="btn-primary">
              Check your loan
            </Link>
            <Link href="/alerts" className="btn-ghost">
              Get free alerts
            </Link>
          </div>
        </section>

        {/* Live tiles */}
        <section className="relative mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="US stock market"
            value={clock ? (clock.open ? "Open" : "Closed") : "…"}
            tone={clock?.open ? "good" : "warn"}
            sub={
              clock
                ? `${clock.open ? "Closes" : "Opens"} in ${formatDuration(clock.minutesUntilChange)}. ${
                    clock.open ? "Tokens and stocks move together." : "Tokens keep trading anyway."
                  }`
                : "Reading the clock…"
            }
          />
          <Tile
            label="Stock collateral on Kamino"
            value={data?.exposure ? formatUsdShort(data.exposure.total) : "…"}
            sub={census ? `${census.borrowers.toLocaleString()} open loans, ${formatUsdShort(census.borrowedUsd)} borrowed` : "Tokenized stocks deposited as collateral"}
          />
          <Tile
            label="Liquidated by a 10% drop"
            value={tenPct ? tenPct.borrowers.toLocaleString() : "…"}
            tone="warn"
            sub={tenPct ? `borrowers, with ${formatUsdShort(tenPct.borrowedUsd)} borrowed` : "Reading every loan…"}
          />
          <Tile
            label="Widest gap right now"
            value={widest ? formatPct(widest.basis) : "…"}
            tone={widest && Math.abs(widest.basis) > 0.02 ? "warn" : "default"}
            sub={widest ? `${widest.ticker}: token vs the real stock` : "Loading live prices…"}
          />
        </section>

        {/* Shock map */}
        <section className="relative mt-4">
          <ShockMap census={census} now={clock?.now ?? null} />
        </section>

        {/* Alerts and gaps */}
        <section className="relative mt-4 grid gap-4 lg:grid-cols-2">
          <div className="glass flex flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Telegram alerts</p>
              <span className={`chip ${alertsRunning ? "border-mint/40 text-mint" : "text-text-muted"}`}>
                <span className={`h-2 w-2 rounded-full ${alertsRunning ? "bg-mint" : "bg-white/30"}`} />
                {lastRun === null ? "Checking…" : alertsRunning ? `Running · checked ${alertsAgo} min ago` : "Paused"}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold">A warning before the gap, not a notice after it.</h2>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>
                <span className="text-text-primary">Friday, 3pm New York.</span> How far your stocks can fall before
                your loan breaks.
              </li>
              <li>
                <span className="text-text-primary">Any time.</span> When your cushion falls under 15%, 10% or 5%.
              </li>
              <li>
                <span className="text-text-primary">Monday, 9am New York.</span> Where you stand before the open.
              </li>
            </ul>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
              <a href="https://t.me/GAPSTOCK_BOT" target="_blank" rel="noopener noreferrer" className="btn-primary !py-2 !text-sm">
                Open @GAPSTOCK_BOT
              </a>
              <Link href="/alerts" className="text-sm text-text-secondary underline hover:text-text-primary">
                How it works
              </Link>
            </div>
          </div>

          <div className="glass flex flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Gap right now</p>
              <Link href="/radar" className="text-xs text-text-secondary underline hover:text-text-primary">
                Full radar
              </Link>
            </div>
            <ol className="mt-4 space-y-2.5">
              {topGaps.length === 0 && <li className="text-sm text-text-muted">Loading live prices…</li>}
              {topGaps.map((s) => {
                const width = Math.min(100, (Math.abs(s.basis) / 0.05) * 100);
                return (
                  <li key={s.ticker}>
                    <Link href={`/stock/${s.ticker}`} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 text-sm hover:text-mint">
                      <span className="font-medium">{s.ticker}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <span
                          className={`block h-full rounded-full ${Math.abs(s.basis) > 0.02 ? "bg-amber-300" : "bg-sky"}`}
                          style={{ width: `${Math.max(2, width)}%` }}
                        />
                      </span>
                      <span className={`text-right font-mono tabular-nums ${Math.abs(s.basis) > 0.02 ? "text-amber-300" : "text-text-secondary"}`}>
                        {formatPct(s.basis)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <p className="mt-auto pt-5 text-xs text-text-muted">
              How far each token&apos;s price on Solana sits from the real stock. Bars fill at a 5% gap.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
