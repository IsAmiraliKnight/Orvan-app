import { daysBetween } from "./dates";
import type { LocalDate, Streak } from "./types";

export const STREAK_MILESTONES: ReadonlyArray<readonly [number, number]> = [
  [7, 25],
  [14, 50],
  [30, 150],
  [60, 300],
  [100, 500],
];

export const MAX_FREEZES = 2;

export interface StreakUpdate {
  streak: Streak;
  /** Bonus XP if this completion landed on a milestone day. */
  bonusXp: number;
  freezeUsed: boolean;
  extended: boolean;
}

/**
 * Advance the streak for a day on which the user completed at least one task.
 * Idempotent: calling it twice on the same day changes nothing, so every task
 * completion can safely run it.
 */
export function registerActivity(streak: Streak, date: LocalDate): StreakUpdate {
  const unchanged: StreakUpdate = {
    streak,
    bonusXp: 0,
    freezeUsed: false,
    extended: false,
  };

  if (streak.lastActiveDate === date) return unchanged;

  const gap = streak.lastActiveDate
    ? daysBetween(streak.lastActiveDate, date)
    : Number.POSITIVE_INFINITY;

  // Guard against a clock roll-back producing a date before the last activity.
  if (gap <= 0) return unchanged;

  let current: number;
  let freezeUsed = false;

  if (gap === 1) {
    current = streak.current + 1;
  } else if (gap === 2 && streak.freezesOwned > 0) {
    // Exactly one missed day, covered by a freeze.
    current = streak.current + 1;
    freezeUsed = true;
  } else {
    current = 1;
  }

  const next: Streak = {
    current,
    longest: Math.max(streak.longest, current),
    lastActiveDate: date,
    freezesOwned: streak.freezesOwned - (freezeUsed ? 1 : 0),
  };

  const milestone = STREAK_MILESTONES.find(([days]) => days === current);

  return {
    streak: next,
    bonusXp: milestone ? milestone[1] : 0,
    freezeUsed,
    extended: true,
  };
}

export function nextMilestone(current: number): { days: number; xp: number } | null {
  const found = STREAK_MILESTONES.find(([days]) => days > current);
  return found ? { days: found[0], xp: found[1] } : null;
}

/**
 * A streak is only alive if it was touched today or yesterday. Used for
 * display so a dead streak does not keep showing a proud number.
 */
export function isStreakAlive(streak: Streak, today: LocalDate): boolean {
  if (!streak.lastActiveDate) return false;
  return daysBetween(streak.lastActiveDate, today) <= 1;
}
