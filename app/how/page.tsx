import Link from "next/link";
import { WeekStrip } from "@/components/home/WeekStrip";
import { GapCalculator } from "@/components/home/GapCalculator";
import { Roadmap } from "@/components/home/Roadmap";
import { Faq } from "@/components/home/Faq";

const INSURANCE_STEPS = [
  {
    title: "Buy protection",
    body: "Pay a small fee in USDC for one stock and one weekend. You receive protection tokens from a Meteora bonding curve.",
  },
  {
    title: "The window runs",
    body: "From Friday's close to Monday's open, the real market is shut and the token keeps trading.",
  },
  {
    title: "Pyth settles it",
    body: "The close and the open are read from Pyth's price history and written into a Solana transaction, timestamps included.",
  },
  {
    title: "Paid, or the fee is kept",
    body: "A move past 3% pays protection holders back. Anything smaller and the pool keeps the fees.",
  },
];

const WHY_SOLANA = [
  {
    title: "It trades around the clock",
    body: "The problem only exists because these tokens settle in seconds, every hour of every day.",
  },
  {
    title: "The data is already on-chain",
    body: "Kamino holds the loans and prices them on Solana, so anyone can read a loan's real breaking point without asking permission.",
  },
  {
    title: "Cheap enough to protect small positions",
    body: "A protection purchase costs a fraction of a cent in fees, so even a small holder can cover a weekend.",
  },
];

export default function HowPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-8 sm:px-8">
      <p className="eyebrow">How it works</p>
      <h1 className="display mt-4 max-w-3xl text-4xl sm:text-5xl">The stock works office hours. The token works every hour.</h1>
      <p className="mt-4 max-w-2xl text-text-secondary">
        A stock like Tesla trades about 32 hours a week. Its token on Solana trades all 168. In every hour that isn&apos;t
        lime below, the real price stands still while the token keeps moving, and nothing checks it until the market
        reopens. When it does, the token has to catch up, sometimes in one jump. That jump is the gap.
      </p>
      <div className="mt-8">
        <WeekStrip />
      </div>

      <section id="calculator" className="scroll-mt-28 pt-20">
        <p className="eyebrow">Feel the gap</p>
        <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">What would a weekend move do to you?</h2>
        <p className="mb-6 mt-3 max-w-2xl text-text-secondary">
          No wallet needed. Pick a position and a move. To see it with a real loan, use{" "}
          <Link href="/portfolio" className="underline hover:text-text-primary">
            Your risk
          </Link>
          .
        </p>
        <GapCalculator />
      </section>

      <section id="insurance" className="scroll-mt-28 pt-20">
        <p className="eyebrow">Gap Insurance</p>
        <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">One stock, one weekend, one clear rule.</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INSURANCE_STEPS.map((step, i) => (
            <li key={step.title} className="glass relative p-5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-mint/15 font-mono text-xs text-mint">
                {i + 1}
              </span>
              <p className="mt-3 font-semibold">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-text-muted">
          It has run on mainnet with real USDC and is not audited, so it stays a demo for now. Try it free on the test
          network on{" "}
          <Link href="/protect" className="underline hover:text-text-primary">
            Gap Insurance
          </Link>
          .
        </p>
      </section>

      <section className="grid gap-10 pt-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="eyebrow">Why Solana</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">This problem only exists because of how Solana works.</h2>
        </div>
        <div className="space-y-8">
          {WHY_SOLANA.map((w) => (
            <div key={w.title}>
              <p className="font-semibold">{w.title}</p>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-text-secondary">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roadmap" className="scroll-mt-28 pt-20">
        <p className="eyebrow">Roadmap</p>
        <h2 className="display mt-4 max-w-2xl text-3xl sm:text-4xl">What is live today, and what comes next.</h2>
        <div className="mt-8">
          <Roadmap />
        </div>
      </section>

      <section id="faq" className="scroll-mt-28 pt-20">
        <p className="eyebrow">FAQ</p>
        <h2 className="display mt-4 text-3xl sm:text-4xl">Questions, answered plainly.</h2>
        <div className="mt-8">
          <Faq />
        </div>
      </section>
    </main>
  );
}
