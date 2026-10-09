"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { MarketDataSource, StockBasis } from "@/lib/marketData/types";
import type { ReserveExposure } from "@/lib/kamino/exposure";
import type { PreStock } from "@/lib/prestocks/client";
import type { Census } from "@/lib/kamino/census";
import type { RunSummary } from "@/lib/alerts/store";
import { marketCountdown } from "@/lib/marketData/session";

export type RadarResponse = {
  generatedAt: string;
  source: MarketDataSource;
  stocks: StockBasis[];
  exposure: { total: number; byStock: ReserveExposure[] } | null;
  error?: string;
};

export type OverviewResponse = {
  census: Census | null;
  alerts: { bot: string | null; lastRun: RunSummary | null };
};

const POLL_MS = 30_000;

/** Live prices for the tokenized stocks and pre-IPO tokens, refreshed every 30 seconds. */
export function useRadarData() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preStocks, setPreStocks] = useState<PreStock[] | null>(null);
  // Above 0 only while PreStocks is down and its last good prices are shown.
  const [preStocksAge, setPreStocksAge] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function pollPreStocks() {
      try {
        const res = await fetch("/api/prestocks", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.stocks) {
          setPreStocks(json.stocks);
          setPreStocksAge(json.ageMinutes ?? 0);
        }
      } catch {
        // The pre-IPO data is additive; if it fails, the rest still works.
      }
    }

    async function poll() {
      pollPreStocks();
      try {
        const res = await fetch("/api/radar/summary", { cache: "no-store" });
        const json: RadarResponse = await res.json();
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setError(null);
          setData(json);
        }
      } catch {
        if (!cancelled) setError("Could not reach GapGuard's server. Try refreshing.");
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, error, preStocks, preStocksAge };
}

/** The Monday shock map and alert status, refreshed every minute. */
export function useOverview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/overview", { cache: "no-store" });
        const json = (await res.json()) as OverviewResponse;
        if (!cancelled) {
          setOverview(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    poll();
    const id = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { overview, failed };
}

// The clock, re-read every 30 seconds. A string snapshot keeps React from
// re-rendering unless it changes. The server renders without a clock.
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}
function clockSnapshot(): string {
  const { open, minutesUntilChange } = marketCountdown();
  return `${open ? 1 : 0}:${minutesUntilChange}:${Math.floor(Date.now() / 60000)}`;
}

/** Whether the US market is open, minutes until that changes, and "now" in ms (null on the server). */
export function useMarketClock(): { open: boolean; minutesUntilChange: number; now: number } | null {
  const key = useSyncExternalStore(subscribeClock, clockSnapshot, () => null);
  if (!key) return null;
  const [open, mins, minute] = key.split(":").map(Number);
  return { open: open === 1, minutesUntilChange: mins, now: minute * 60000 };
}
