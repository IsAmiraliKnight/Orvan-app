import { addDays, parseLocalDate } from "./dates";
import type { LocalDate, Priority, Recurrence } from "./types";

/**
 * Repeating tasks.
 *
 * There is no expansion pass that fills the calendar with a year of copies —
 * only one occurrence exists at a time, and finishing it spawns the next. A
 * repeating chore is a *habit*: the point is the one in front of you, and an
 * outline stuffed with fifty identical rows would make the day look busy
 * without anything actually being due.
 */

/**
 * Every repeat pays the Medium rate, whatever the user picks elsewhere.
 *
 * A repeating task is by definition the easy kind — it is the same work again.
 * Letting it be marked High would hand out the scarce High slots every single
 * day for free, and the daily limits are the whole reason the score means
 * anything.
 */
export const RECURRING_PRIORITY: Priority = "medium";

export const RECURRENCES: ReadonlyArray<readonly [string, Recurrence | undefined]> = [
  ["Never", undefined],
  ["Daily", { kind: "daily" }],
  ["Weekdays", { kind: "weekdays" }],
  ["Weekly", { kind: "weekly", weekday: 1 }],
];

export function recurrenceLabel(r: Recurrence | undefined): string {
  if (!r) return "Never";
  if (r.kind === "daily") return "Daily";
  if (r.kind === "weekdays") return "Weekdays";
  return "Weekly";
}

/** True when the two describe the same schedule — weekday included. */
export function sameRecurrence(a: Recurrence | undefined, b: Recurrence | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind !== "weekly" || a.weekday === (b as { weekday: number }).weekday;
}

/** Monday = 1 … Sunday = 7, matching the league week rather than `getDay()`. */
export function isoWeekday(date: LocalDate): number {
  return ((parseLocalDate(date).getDay() + 6) % 7) + 1;
}

/**
 * The next date this repeats on, strictly after `from`.
 *
 * "Weekly" anchors to whatever weekday the task was created on rather than the
 * stored one when they disagree — a task moved to Thursday should keep
 * repeating on Thursday, not snap back to the day it was first written.
 */
export function nextOccurrence(from: LocalDate, r: Recurrence): LocalDate {
  if (r.kind === "daily") return addDays(from, 1);
  if (r.kind === "weekly") return addDays(from, 7);

  // Weekdays: skip the weekend rather than piling Saturday's work onto Monday.
  let next = addDays(from, 1);
  while (isoWeekday(next) > 5) next = addDays(next, 1);
  return next;
}
