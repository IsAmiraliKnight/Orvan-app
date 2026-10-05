import type { LocalDate, Priority, XpEvent } from "./types";

export const PRIORITY_XP: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * How many tasks of each priority may earn XP in a single day.
 *
 * The three High slots are a product feature before they are an anti-cheat
 * measure: they force the user to decide each morning what actually matters.
 */
export const PRIORITY_DAILY_LIMIT: Record<Priority, number> = {
  low: Number.POSITIVE_INFINITY,
  medium: 5,
  high: 3,
};

/** Hard ceiling on XP earned from self-created tasks in one day. */
export const DAILY_TASK_XP_CAP = 20;

export type AwardReason = "full" | "priority_limit" | "daily_cap";

export interface Award {
  xp: number;
  reason: AwardReason;
}

function taskEventsOn(events: XpEvent[], date: LocalDate): XpEvent[] {
  return events.filter((e) => e.source === "task" && e.date === date);
}

export function taskXpEarnedOn(events: XpEvent[], date: LocalDate): number {
  return taskEventsOn(events, date).reduce((sum, e) => sum + e.amount, 0);
}

/** Tasks completed on `date`, whether or not they earned XP. */
export function taskCountOn(events: XpEvent[], date: LocalDate): number {
  return taskEventsOn(events, date).length;
}

/**
 * Tasks of `priority` already counted today. Events awarded 0 XP still count —
 * otherwise a capped-out user could keep retrying for a windfall.
 */
export function priorityCountOn(
  events: XpEvent[],
  date: LocalDate,
  priority: Priority,
): number {
  return taskEventsOn(events, date).filter((e) => e.priority === priority).length;
}

export function prioritySlotsLeft(
  events: XpEvent[],
  date: LocalDate,
  priority: Priority,
): number {
  const limit = PRIORITY_DAILY_LIMIT[priority];
  if (limit === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - priorityCountOn(events, date, priority));
}

/**
 * Decide the XP for completing a task, given the day's ledger so far.
 * Pure: the same call on the server must produce the same answer.
 */
export function awardForTaskCompletion(
  events: XpEvent[],
  date: LocalDate,
  priority: Priority,
): Award {
  if (prioritySlotsLeft(events, date, priority) <= 0) {
    return { xp: 0, reason: "priority_limit" };
  }

  const remaining = DAILY_TASK_XP_CAP - taskXpEarnedOn(events, date);
  if (remaining <= 0) return { xp: 0, reason: "daily_cap" };

  const base = PRIORITY_XP[priority];
  if (base > remaining) return { xp: remaining, reason: "daily_cap" };
  return { xp: base, reason: "full" };
}

export function totalXp(events: XpEvent[]): number {
  return events.reduce((sum, e) => sum + e.amount, 0);
}

/** Weekly XP drives league standing — lifetime XP deliberately does not. */
export function xpBetween(
  events: XpEvent[],
  startDate: LocalDate,
  endDate: LocalDate,
): number {
  return events
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .reduce((sum, e) => sum + e.amount, 0);
}
