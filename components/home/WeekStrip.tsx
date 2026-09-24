"use client";

import { useEffect, useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OPEN_HOURS_PER_WEEK = 32.5; // 9:30am to 4:00pm ET, five days

/** Is the US stock market open during this New York hour, on this day (0 = Mon)? */
function cellState(day: number, hour: number): "open" | "half" | "closed" {
  if (day > 4) return "closed";
  if (hour === 9) return "half"; // opens at 9:30
  if (hour >= 10 && hour < 16) return "open";
  return "closed";
}

function nowInNewYork(): { day: number; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
    return day >= 0 ? { day, hour } : null;
  } catch {
    return null;
  }
}

/**
 * One week, hour by hour, New York time. Lime cells are hours the real US
 * stock market is open. The bar above each day is the token, which trades in
 * every hour. Everything outside the lime cells is time the token moves and
 * nothing checks it.
 */
export function WeekStrip() {
  const [now, setNow] = useState<{ day: number; hour: number } | null>(null);

  useEffect(() => {
    setNow(nowInNewYork());
    const id = setInterval(() => setNow(nowInNewYork()), 60_000);
    return () => clearInterval(id);
  }, []);

  const openPct = Math.round((OPEN_HOURS_PER_WEEK / 168) * 100);

  return (
    <div className="glass p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">One week, hour by hour (New York time)</p>
          <p className="mt-1 text-xs text-text-muted">
            Real market open: {OPEN_HOURS_PER_WEEK} of 168 hours ({openPct}%). Token: all 168.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-mint" /> Real market open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-white/10" /> Real market closed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-sky/70" /> Token trading
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {DAYS.map((d, day) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-xs text-text-muted">{d}</span>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 rounded-full bg-sky/50" />
              <div className="flex gap-[2px]">
                {Array.from({ length: 24 }, (_, hour) => {
                  const state = cellState(day, hour);
                  const isNow = now?.day === day && now.hour === hour;
                  return (
                    <span
                      key={hour}
                      title={`${d} ${hour}:00`}
                      className={`h-4 flex-1 rounded-[3px] sm:h-5 ${
                        state === "open"
                          ? "bg-mint"
                          : state === "half"
                          ? "bg-gradient-to-r from-white/10 from-50% to-mint to-50%"
                          : "bg-white/10"
                      } ${isNow ? "ring-2 ring-white ring-offset-1 ring-offset-bg-card" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-11 text-[10px] text-text-muted">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
      {now && (
        <p className="mt-4 text-xs text-text-secondary">
          The white outline is right now. {now.day <= 4 && cellState(now.day, now.hour) !== "closed"
            ? "The real market is open."
            : "The real market is closed. Its price barely moves (and not at all on weekends) while the token keeps moving."}
        </p>
      )}
    </div>
  );
}
