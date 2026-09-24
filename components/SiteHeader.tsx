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

export function SiteHeader({ active = null }: { active?: Active }) {
  return (
    <header className="relative z-10 px-4 py-5 sm:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-xl font-semibold tracking-tight">GapGuard</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm sm:gap-7">
          <Link href="/#radar" className={`hidden sm:inline ${linkClass(active === "radar")}`}>
            Radar
          </Link>
          <Link href="/portfolio" className={linkClass(active === "risk")}>
            Your risk
          </Link>
          <Link href="/protect" className={linkClass(active === "insurance")}>
            Gap Insurance
          </Link>
        </nav>
      </div>
    </header>
  );
}
