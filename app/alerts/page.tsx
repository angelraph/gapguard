"use client";

import Link from "next/link";
import { useMarketClock, useOverview } from "@/lib/useLiveData";
import { minutesAgo } from "@/lib/format";

const BOT_URL = "https://t.me/GAPSTOCK_BOT";

/** Example messages, written exactly the way the bot words them. */
const EXAMPLES = [
  {
    when: "Friday, 3pm New York",
    title: "The stock market closes for the weekend at 4pm New York time",
    body: "Your loan survives a drop of up to 8.4% in your stocks. Until Monday's open, the token keeps trading while the real market is shut, and Monday can open with a jump. Weekend moves that size do happen.",
    fix: "To get back to a safe 25% cushion, repay about $640 or add about $1,210 more of your stock tokens as collateral.",
  },
  {
    when: "Sunday night, the moment it happens",
    title: "Your Kamino loan is getting close to liquidation",
    body: "If your stocks fall another 4.6%, Kamino can liquidate this loan and sell part of your collateral at a discount.",
    fix: "To get back to a safe 25% cushion, repay about $910 or add about $1,730 more of your stock tokens as collateral.",
  },
  {
    when: "Monday, 9am New York",
    title: "The stock market opens in under an hour",
    body: "Right now your loan survives a drop of up to 4.6%. When the market opens, the token catches up with the real stock price, sometimes all at once.",
    fix: null,
  },
];

const STEPS = [
  { title: "Open the bot", body: "Tap the button below, or search @GAPSTOCK_BOT in Telegram, and press Start." },
  { title: "Send your wallet address", body: "Paste the Solana address you borrow from. It replies straight away with your breaking point." },
  { title: "Get on with your weekend", body: "It checks your loan every 5 minutes and only messages you when something matters." },
];

export default function AlertsPage() {
  const { overview } = useOverview();
  const clock = useMarketClock();
  const lastRun = overview?.alerts.lastRun ?? null;
  const ago = lastRun && clock ? minutesAgo(lastRun.at, clock.now) : null;
  const running = ago !== null && ago <= 15;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-8 sm:px-8">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="eyebrow">Telegram alerts</p>
          <h1 className="display mt-4 text-4xl sm:text-5xl">Your loan, watched all weekend.</h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-text-secondary">
            Send your wallet to the GapGuard bot once. It watches your Kamino loan every 5 minutes and messages you before
            a weekend gap can liquidate it, with a number that tells you exactly how to fix it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Open @GAPSTOCK_BOT
            </a>
            <Link href="/portfolio" className="btn-ghost">
              Check a wallet first
            </Link>
          </div>
          <p className="mt-5 text-sm text-text-muted">
            Free. Read-only: it never asks you to connect a wallet or sign anything. Anyone who messages you claiming to
            be GapGuard support and asks for your seed phrase is a scammer.
          </p>

          <ol className="mt-10 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-mint/40 font-mono text-xs text-mint">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="mt-1 block text-sm text-text-secondary">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="glass p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Alert system</p>
              <span className={`chip ${running ? "border-mint/40 text-mint" : "text-text-muted"}`}>
                <span className={`h-2 w-2 rounded-full ${running ? "bg-mint" : "bg-white/30"}`} />
                {lastRun === null ? "Checking…" : running ? "Running" : "Paused"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Last check</dt>
                <dd className="mt-1 font-mono tabular-nums">{ago === null ? "…" : ago === 0 ? "just now" : `${ago} min ago`}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Wallets watched</dt>
                <dd className="mt-1 font-mono tabular-nums">{lastRun ? lastRun.wallets : "…"}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Checks</dt>
                <dd className="mt-1">Every 5 minutes, all week</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Prices</dt>
                <dd className="mt-1">Kamino&apos;s own liquidation feed</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-[#0e1621] p-4">
            <p className="px-1 text-xs uppercase tracking-[0.12em] text-text-muted">What it sends (example)</p>
            <div className="mt-3 space-y-3">
              {EXAMPLES.map((m) => (
                <div key={m.title}>
                  <p className="px-1 text-[11px] text-text-muted">{m.when}</p>
                  <div className="mt-1 max-w-[95%] rounded-2xl rounded-tl-md bg-[#182533] px-4 py-3 text-[13px] leading-relaxed text-[#e8edf2]">
                    <p className="font-semibold">{m.title}</p>
                    <p className="mt-1">{m.body}</p>
                    {m.fix && <p className="mt-1">{m.fix}</p>}
                    <p className="mt-2 text-[#6ab3f3]">Open Kamino · See it on GapGuard</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pt-16">
        <h2 className="text-xl font-semibold">Commands</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["/status", "How safe your loan is right now"],
            ["/wallets", "The wallets you're watching (up to 5)"],
            ["/remove", "Stop watching one wallet"],
            ["/stop", "Turn everything off and forget your wallets"],
          ].map(([cmd, what]) => (
            <div key={cmd} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <dt className="font-mono text-sm text-mint">{cmd}</dt>
              <dd className="mt-1 text-sm text-text-secondary">{what}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
