/**
 * Is the US stock market in its regular session right now? Regular hours
 * are 9:30am to 4:00pm New York time, Monday to Friday. This ignores
 * exchange holidays, which are rare and only make the flag say "open" on a
 * closed day.
 *
 * This is used instead of "has the price feed updated recently", because
 * Pyth (and others) keep publishing thinner after-hours prices, so a feed
 * that is still updating does not mean the regular market is open.
 */
export function isRegularSessionOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** The current New York weekday, time and date, for scheduling messages. */
export function newYorkClock(now: Date = new Date()): {
  weekday: string;
  minutes: number;
  date: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}
