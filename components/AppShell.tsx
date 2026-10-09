"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMarketClock } from "@/lib/useLiveData";
import { formatDuration } from "@/lib/format";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[9px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #c58ae6, #7cc7ff 55%, #3ddc97)",
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 18 18" fill="none">
        <path d="M2 5.5h14" stroke="#04130c" strokeWidth="2" strokeLinecap="round" />
        <path d="M2 12.5h14" stroke="#04130c" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 7.6v2.8" stroke="#04130c" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 2.4" />
      </svg>
    </span>
  );
}

/** Every page, in the order a first-time visitor should see them. */
export const PAGES = [
  { href: "/", label: "Command center", hint: "Live overview" },
  { href: "/radar", label: "Gap radar", hint: "Token vs real price" },
  { href: "/portfolio", label: "Your risk", hint: "Check any wallet" },
  { href: "/alerts", label: "Alerts", hint: "Telegram warnings" },
  { href: "/protect", label: "Gap Insurance", hint: "Weekend cover, demo" },
  { href: "/how", label: "How it works", hint: "The gap, explained" },
] as const;

function pageIndex(pathname: string): number {
  if (pathname.startsWith("/stock/")) return 1; // a stock's detail page belongs to the radar
  const i = PAGES.findIndex((p) => p.href === pathname);
  return i;
}

const num = (i: number) => String(i + 1).padStart(2, "0");

function MarketChip() {
  const clock = useMarketClock();
  if (!clock) return <span className="chip text-text-muted">Market status…</span>;
  return (
    <span className="chip">
      <span className="relative flex h-2 w-2">
        {clock.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${clock.open ? "bg-mint" : "bg-amber-300"}`} />
      </span>
      <span className="text-text-primary">US market {clock.open ? "open" : "closed"}</span>
      <span className="text-text-muted">
        {clock.open ? "closes" : "opens"} in {formatDuration(clock.minutesUntilChange)}
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = pageIndex(pathname);
  // Each page leads to the next; the last one loops back to the start.
  const nextIndex = current >= 0 ? (current + 1) % PAGES.length : -1;
  const next = nextIndex >= 0 ? PAGES[nextIndex] : null;

  return (
    <div className="flex min-h-screen flex-1">
      {/* Sidebar, laptop and up */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-bg-elevated/70 px-4 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <LogoMark />
          <span className="text-xl font-semibold tracking-tight">GapGuard</span>
        </Link>
        <p className="mt-2 px-2 text-xs leading-relaxed text-text-muted">
          Weekend gap risk for tokenized stocks on Solana.
        </p>

        <nav className="mt-7 flex flex-col gap-1" aria-label="Pages">
          {PAGES.map((p, i) => {
            const active = i === current;
            return (
              <Link
                key={p.href}
                href={p.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  active ? "bg-white/[0.07] text-text-primary" : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-mint" aria-hidden />}
                <span className={`font-mono text-xs tabular-nums ${active ? "text-mint" : "text-text-muted"}`}>{num(i)}</span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-[11px] text-text-muted">{p.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 px-2">
          <a
            href="https://t.me/GAPSTOCK_BOT"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-mint/30 bg-mint/[0.06] px-3 py-2.5 text-sm hover:border-mint/60"
          >
            <span className="font-medium text-mint">Get Telegram alerts</span>
            <span className="mt-0.5 block text-[11px] text-text-muted">Free, read-only, @GAPSTOCK_BOT</span>
          </a>
          <p className="text-[11px] leading-relaxed text-text-muted">
            Built for the Stocklana hackathon.{" "}
            <a className="underline hover:text-text-secondary" href="https://github.com/angelraph/gapguard" target="_blank" rel="noopener noreferrer">
              Code
            </a>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: brand and numbered tabs on phones, section title on laptops */}
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg-primary/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <LogoMark size={26} />
              <span className="text-lg font-semibold tracking-tight">GapGuard</span>
            </Link>
            {current >= 0 && (
              <p className="hidden items-center gap-3 lg:flex">
                <span className="rounded-full border border-mint/40 px-2.5 py-0.5 font-mono text-xs text-mint">{num(current)}</span>
                <span className="text-sm font-medium">{PAGES[current].label}</span>
                <span className="text-sm text-text-muted">{PAGES[current].hint}</span>
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex">
                <MarketChip />
              </span>
              {/* Wrapped: .btn-primary sets its own display, which would beat lg:hidden. */}
              <span className="lg:hidden">
                <a
                  href="https://t.me/GAPSTOCK_BOT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary !px-3.5 !py-1.5 !text-xs"
                >
                  Get alerts
                </a>
              </span>
            </div>
          </div>
          <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2.5 lg:hidden" aria-label="Pages">
            {PAGES.map((p, i) => {
              const active = i === current;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                    active ? "border-mint/50 bg-mint/10 text-text-primary" : "border-white/10 text-text-secondary"
                  }`}
                >
                  <span className={`font-mono ${active ? "text-mint" : "text-text-muted"}`}>{num(i)}</span>
                  {p.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="flex flex-1 flex-col">{children}</div>

        {next && (
          <div className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-8">
            <Link
              href={next.href}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition-colors hover:border-mint/40 hover:bg-mint/[0.04]"
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.12em] text-text-muted">
                  {nextIndex === 0 ? "Back to the start" : "Next"}
                </span>
                <span className="mt-1 flex items-baseline gap-3">
                  <span className="font-mono text-sm text-mint">{num(nextIndex)}</span>
                  <span className="text-lg font-semibold">{next.label}</span>
                  <span className="hidden text-sm text-text-muted sm:inline">{next.hint}</span>
                </span>
              </span>
              <span className="text-xl text-text-secondary transition-transform group-hover:translate-x-1" aria-hidden>
                →
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
