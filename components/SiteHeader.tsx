import Link from "next/link";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-[9px]"
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

type Active = "radar" | "risk" | "insurance" | null;

const linkClass = (on: boolean) =>
  on ? "text-text-primary" : "text-text-secondary hover:text-text-primary";

/** Jump links to sections of the home page, shown from tablet size up. */
const SECTION_LINKS = [
  { href: "/#why", label: "The gap" },
  { href: "/#radar", label: "Radar" },
  { href: "/#pre-ipo", label: "Pre-IPO" },
  { href: "/#insurance", label: "How insurance works" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader({ active = null }: { active?: Active }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg-primary/80 px-4 py-3.5 backdrop-blur-md sm:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <LogoMark />
          <span className="text-xl font-semibold tracking-tight">GapGuard</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm sm:gap-5">
          {SECTION_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hidden whitespace-nowrap text-text-secondary hover:text-text-primary lg:inline"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/portfolio" className={`whitespace-nowrap ${linkClass(active === "risk")}`}>
            Your risk
          </Link>
          <Link
            href="/protect"
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 ${
              active === "insurance"
                ? "border-mint/60 text-mint"
                : "border-white/15 text-text-primary hover:border-white/40"
            }`}
          >
            Gap Insurance
          </Link>
        </nav>
      </div>
    </header>
  );
}
