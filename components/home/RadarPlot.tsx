"use client";

export type RadarPoint = {
  label: string;
  /** (on-chain price - reference price) / reference price, as a fraction */
  gap: number;
  kind: "stock" | "pre-ipo";
};

const CX = 230;
const CY = 230;
const R = 200;

/** Distance from the centre grows with the size of the gap but flattens out,
 * so a 0.3% gap and a 30% gap can share one picture. */
function radiusFor(gap: number): number {
  return 26 + (R - 26) * Math.tanh(Math.abs(gap) / 0.06);
}

const RINGS: { gap: number; label: string; trigger?: boolean }[] = [
  { gap: 0.01, label: "1%" },
  { gap: 0.03, label: "3%", trigger: true },
  { gap: 0.1, label: "10%" },
];

function isHot(p: RadarPoint): boolean {
  return Math.abs(p.gap) > (p.kind === "stock" ? 0.03 : 0.1);
}

/**
 * A live radar of every token GapGuard tracks. Each dot is one token; the
 * further it sits from the centre, the further its on-chain price is from the
 * real price (or the issuer's mark, for pre-IPO tokens). The dashed ring is
 * the 3% move that triggers Gap Insurance.
 */
export function RadarPlot({ points }: { points: RadarPoint[] }) {
  const n = Math.max(points.length, 1);

  return (
    <figure className="mx-auto w-full max-w-[520px]">
      <svg
        viewBox="0 0 460 460"
        role="img"
        aria-label="Radar showing how far each tracked token's price sits from its reference price"
        className="h-auto w-full overflow-visible"
      >
        <defs>
          <radialGradient id="rp-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b8f56b" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#b8f56b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rp-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b8f56b" stopOpacity="0" />
            <stop offset="100%" stopColor="#b8f56b" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R + 10} fill="url(#rp-bg)" />

        {/* crosshair */}
        <path
          d={`M${CX - R - 10} ${CY}H${CX + R + 10}M${CX} ${CY - R - 10}V${CY + R + 10}`}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />

        {RINGS.map((ring) => {
          const r = radiusFor(ring.gap);
          return (
            <g key={ring.label}>
              <circle
                cx={CX}
                cy={CY}
                r={r}
                fill="none"
                stroke={ring.trigger ? "rgba(255,181,71,0.75)" : "rgba(255,255,255,0.12)"}
                strokeWidth={ring.trigger ? 1.4 : 1}
                strokeDasharray={ring.trigger ? "5 5" : undefined}
              />
              <text
                x={CX + 4}
                y={CY - r - 4}
                fontSize="9"
                fill={ring.trigger ? "#ffb547" : "rgba(255,255,255,0.4)"}
                fontFamily="var(--font-jetbrains-mono), monospace"
              >
                {ring.trigger ? "3% insurance trigger" : ring.label}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />

        {/* sweeping beam */}
        <g className="radar-sweep">
          <path d={`M${CX} ${CY} L${CX + R} ${CY} A${R} ${R} 0 0 0 ${CX + R * Math.cos(-0.7)} ${CY + R * Math.sin(-0.7)} Z`} fill="url(#rp-beam)" />
          <line x1={CX} y1={CY} x2={CX + R} y2={CY} stroke="#b8f56b" strokeOpacity="0.55" strokeWidth="1" />
        </g>

        {points.map((p, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const r = radiusFor(p.gap);
          const x = CX + r * Math.cos(angle);
          const y = CY + r * Math.sin(angle);
          const hot = isHot(p);
          const color = hot ? "#ffb547" : p.kind === "stock" ? "#7cc7ff" : "#c58ae6";
          // Alternate the label distance so neighbours near the centre don't collide.
          const labelGap = 12 + (i % 2) * 13;
          const lx = CX + (r + labelGap) * Math.cos(angle);
          const ly = CY + (r + labelGap) * Math.sin(angle);
          const anchor = Math.cos(angle) > 0.25 ? "start" : Math.cos(angle) < -0.25 ? "end" : "middle";
          const pct = `${p.gap >= 0 ? "+" : ""}${(p.gap * 100).toFixed(2)}%`;
          return (
            <g key={`${p.kind}-${p.label}`}>
              {hot && (
                <circle cx={x} cy={y} r="5" fill="none" stroke={color} strokeWidth="1.2" className="blip-pulse" />
              )}
              <circle cx={x} cy={y} r="5" fill={color}>
                <title>{`${p.label} ${pct}`}</title>
              </circle>
              <text
                x={lx}
                y={ly + 3}
                fontSize="9.5"
                fill="rgba(255,255,255,0.78)"
                textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono), monospace"
              >
                {p.label}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r="3" fill="#b8f56b" />
      </svg>

      <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky" /> Tokenized stock
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet" /> Pre-IPO token
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ffb547]" /> Past its trigger
        </span>
        <span className="w-full text-center">
          Distance from the centre is the size of the gap. Live.
        </span>
      </figcaption>
    </figure>
  );
}
