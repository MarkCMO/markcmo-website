// "HH:mm" parsing, quiet-hours math, and day helpers. Ported from TimeUtilities.swift
// (Section 7). Uses local-time Date math so day boundaries and DST behave correctly.

export function components(hhmm: string): { hour: number; minute: number } {
  const parts = hhmm.split(":");
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { hour: h, minute: m };
    }
  }
  return { hour: 8, minute: 0 };
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 0);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function dateOnDayAtTime(day: Date, hhmm: string): Date {
  const c = components(hhmm);
  const x = new Date(day);
  x.setHours(c.hour, c.minute, 0, 0);
  return x;
}

export function minutesSinceMidnightStr(hhmm: string): number {
  const c = components(hhmm);
  return c.hour * 60 + c.minute;
}

export function minutesSinceMidnightDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isInQuietHours(d: Date, start: string, end: string): boolean {
  const now = minutesSinceMidnightDate(d);
  const s = minutesSinceMidnightStr(start);
  const e = minutesSinceMidnightStr(end);
  if (s === e) return false;
  if (s < e) return now >= s && now < e;       // same-day window
  return now >= s || now < e;                  // wraps past midnight
}

export function shiftedOutOfQuietHours(d: Date, start: string, end: string): Date {
  if (!isInQuietHours(d, start, end)) return d;
  const endC = components(end);
  const nowMinutes = minutesSinceMidnightDate(d);
  const endMinutes = minutesSinceMidnightStr(end);
  const startMinutes = minutesSinceMidnightStr(start);
  const crossesMidnight = startMinutes > endMinutes;
  let base = new Date(d);
  if (crossesMidnight && nowMinutes >= startMinutes) {
    base = addDays(base, 1);
  }
  base.setHours(endC.hour, endC.minute, 0, 0);
  return base;
}

// Spread `count` daily slots across the waking day (Section 6).
export function dailySlotTimes(count: number, firstSlot: string, wake: string, quietStart: string): string[] {
  if (count <= 1) return [firstSlot];
  const firstMinutes = minutesSinceMidnightStr(firstSlot);
  const wakeMinutes = minutesSinceMidnightStr(wake);
  let endMinutes = minutesSinceMidnightStr(quietStart);
  if (endMinutes <= wakeMinutes) endMinutes = 23 * 60 + 59;
  const lowerBound = Math.max(wakeMinutes, firstMinutes);
  if (endMinutes <= lowerBound) return new Array(count).fill(firstSlot);
  const step = Math.floor((endMinutes - lowerBound) / Math.max(count - 1, 1));
  const result = [firstSlot];
  for (let i = 1; i < count; i++) {
    const minutes = Math.min(lowerBound + step * i, endMinutes);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    result.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return result;
}
