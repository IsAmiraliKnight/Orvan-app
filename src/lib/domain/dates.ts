import type { LocalDate } from "./types";

/** Local calendar date, not UTC — a task done at 11pm belongs to that day. */
export function toLocalDate(d: Date = new Date()): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  const ms = parseLocalDate(to).getTime() - parseLocalDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function today(): LocalDate {
  return toLocalDate();
}

/** Monday-anchored, matching the league reset. */
export function startOfWeek(date: LocalDate): LocalDate {
  const d = parseLocalDate(date);
  const offset = (d.getDay() + 6) % 7;
  return addDays(date, -offset);
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const d = parseLocalDate(startOfMonth(date));
  d.setMonth(d.getMonth() + months);
  return toLocalDate(d);
}

export function monthDays(date: LocalDate): LocalDate[] {
  const start = startOfMonth(date);
  const count = daysBetween(start, addMonths(start, 1));
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Full Monday-to-Sunday rows, including the adjoining month's days. */
export function monthGridDays(date: LocalDate): LocalDate[] {
  const start = startOfWeek(startOfMonth(date));
  const end = addDays(startOfWeek(addDays(addMonths(date, 1), -1)), 6);
  return Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDays(start, i));
}

export function formatDayLabel(date: LocalDate, now: LocalDate = today()): string {
  if (date === now) return "Today";
  if (date === addDays(now, 1)) return "Tomorrow";
  if (date === addDays(now, -1)) return "Yesterday";
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
