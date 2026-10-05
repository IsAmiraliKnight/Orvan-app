import type { LocalDate, XpEvent } from "./types";
import {
  DAILY_TASK_XP_CAP,
  PRIORITY_DAILY_LIMIT,
  priorityCountOn,
  taskCountOn,
  taskXpEarnedOn,
} from "./xp";

export interface DailyQuest {
  key: string;
  label: string;
  progress: number;
  target: number;
  xp: number;
}

/**
 * MVP quests are derived from the XP ledger rather than stored, so there is no
 * state to keep in sync. The rule-based template engine and the actual payout
 * land in P2 — until then these read as progress, not as a promise.
 */
export function dailyQuests(events: XpEvent[], date: LocalDate): DailyQuest[] {
  return [
    {
      key: "three-tasks",
      label: "Complete 3 tasks",
      progress: taskCountOn(events, date),
      target: 3,
      xp: 10,
    },
    {
      key: "high-slots",
      label: "Use all your High slots",
      progress: priorityCountOn(events, date, "high"),
      target: PRIORITY_DAILY_LIMIT.high,
      xp: 10,
    },
    {
      key: "max-xp",
      label: "Max out today's task XP",
      progress: taskXpEarnedOn(events, date),
      target: DAILY_TASK_XP_CAP,
      xp: 10,
    },
  ];
}
