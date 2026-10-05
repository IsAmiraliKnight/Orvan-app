import assert from "node:assert/strict";
import { test } from "node:test";

import { registerActivity } from "./streak";
import { levelFromTotalXp, totalXpForLevel, xpToNextLevel } from "./level";
import type { LocalDate, Priority, Streak, XpEvent } from "./types";
import {
  DAILY_TASK_XP_CAP,
  awardForTaskCompletion,
  prioritySlotsLeft,
  taskXpEarnedOn,
} from "./xp";

const DAY: LocalDate = "2026-03-02";

function taskEvent(priority: Priority, amount: number, date: LocalDate = DAY): XpEvent {
  return {
    id: Math.random().toString(36).slice(2),
    source: "task",
    amount,
    priority,
    date,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

/** Complete `count` tasks of one priority, threading the ledger through. */
function grind(count: number, priority: Priority, from: XpEvent[] = []): XpEvent[] {
  const events = [...from];
  for (let i = 0; i < count; i++) {
    const award = awardForTaskCompletion(events, DAY, priority);
    events.push(taskEvent(priority, award.xp));
  }
  return events;
}

test("priority sets the base award", () => {
  assert.equal(awardForTaskCompletion([], DAY, "low").xp, 1);
  assert.equal(awardForTaskCompletion([], DAY, "medium").xp, 2);
  assert.equal(awardForTaskCompletion([], DAY, "high").xp, 3);
});

test("high priority is limited to three slots a day", () => {
  const events = grind(3, "high");
  assert.equal(taskXpEarnedOn(events, DAY), 9);
  assert.equal(prioritySlotsLeft(events, DAY, "high"), 0);

  const fourth = awardForTaskCompletion(events, DAY, "high");
  assert.equal(fourth.xp, 0);
  assert.equal(fourth.reason, "priority_limit");
});

test("medium priority is limited to five slots a day", () => {
  const events = grind(5, "medium");
  assert.equal(taskXpEarnedOn(events, DAY), 10);
  assert.equal(awardForTaskCompletion(events, DAY, "medium").reason, "priority_limit");
});

test("zero-XP completions still consume a slot", () => {
  // Otherwise a capped user could retry forever hoping for a windfall.
  const events = grind(6, "high");
  assert.equal(events.filter((e) => e.priority === "high").length, 6);
  assert.equal(prioritySlotsLeft(events, DAY, "high"), 0);
  assert.equal(taskXpEarnedOn(events, DAY), 9);
});

test("attacker farming low-priority tasks cannot exceed the daily cap", () => {
  const events = grind(500, "low");
  assert.equal(taskXpEarnedOn(events, DAY), DAILY_TASK_XP_CAP);
  assert.equal(awardForTaskCompletion(events, DAY, "low").reason, "daily_cap");
});

test("mixing every priority still cannot exceed the daily cap", () => {
  let events = grind(3, "high");
  events = grind(5, "medium", events);
  events = grind(200, "low", events);
  assert.equal(taskXpEarnedOn(events, DAY), DAILY_TASK_XP_CAP);
});

test("the final award is clamped to the remaining cap, not truncated to zero", () => {
  // 9 (high) + 10 (medium) = 19, so a 2-XP medium task may only pay out 1.
  let events = grind(3, "high");
  events = grind(5, "medium", events);
  assert.equal(taskXpEarnedOn(events, DAY), 19);

  const award = awardForTaskCompletion(events, DAY, "low");
  assert.equal(award.xp, 1);
  assert.equal(award.reason, "full");
});

test("caps are per-day, so yesterday's ledger does not leak into today", () => {
  const yesterday = grind(500, "low").map((e) => ({ ...e, date: "2026-03-01" }));
  assert.equal(taskXpEarnedOn(yesterday, DAY), 0);
  assert.equal(awardForTaskCompletion(yesterday, DAY, "high").xp, 3);
});

test("quest XP is not subject to the task cap", () => {
  const events = grind(500, "low");
  assert.equal(taskXpEarnedOn(events, DAY), DAILY_TASK_XP_CAP);
  // Quests are handed out by Orvan, so they bypass the anti-farm ceiling.
  const withQuest: XpEvent[] = [
    ...events,
    { id: "q", source: "quest", amount: 10, date: DAY, createdAt: "" },
  ];
  assert.equal(taskXpEarnedOn(withQuest, DAY), DAILY_TASK_XP_CAP);
});

test("level curve matches the spec's pacing", () => {
  assert.equal(xpToNextLevel(1), 50);
  assert.equal(totalXpForLevel(10), 1350);
  assert.equal(totalXpForLevel(20), 5225);

  assert.equal(levelFromTotalXp(0).level, 1);
  assert.equal(levelFromTotalXp(49).level, 1);
  assert.equal(levelFromTotalXp(50).level, 2);
  assert.equal(levelFromTotalXp(1350).level, 10);
});

test("level progress reports position inside the current level", () => {
  const p = levelFromTotalXp(60);
  assert.equal(p.level, 2);
  assert.equal(p.xpIntoLevel, 10);
  assert.equal(p.xpForNext, 75);
});

test("level is capped and never overflows", () => {
  const p = levelFromTotalXp(10_000_000);
  assert.equal(p.level, 50);
  assert.equal(p.isMaxLevel, true);
  assert.equal(p.xpForNext, 0);
});

const freshStreak: Streak = { current: 0, longest: 0, freezesOwned: 0 };

test("consecutive days extend the streak", () => {
  const a = registerActivity(freshStreak, "2026-03-01");
  assert.equal(a.streak.current, 1);
  const b = registerActivity(a.streak, "2026-03-02");
  assert.equal(b.streak.current, 2);
});

test("registering twice in one day is a no-op", () => {
  const a = registerActivity(freshStreak, "2026-03-01");
  const b = registerActivity(a.streak, "2026-03-01");
  assert.equal(b.streak.current, 1);
  assert.equal(b.extended, false);
});

test("a missed day resets the streak but keeps the record", () => {
  const streak: Streak = {
    current: 9,
    longest: 9,
    lastActiveDate: "2026-03-01",
    freezesOwned: 0,
  };
  const result = registerActivity(streak, "2026-03-03");
  assert.equal(result.streak.current, 1);
  assert.equal(result.streak.longest, 9);
});

test("a freeze covers exactly one missed day and is consumed", () => {
  const streak: Streak = {
    current: 9,
    longest: 9,
    lastActiveDate: "2026-03-01",
    freezesOwned: 1,
  };
  const result = registerActivity(streak, "2026-03-03");
  assert.equal(result.streak.current, 10);
  assert.equal(result.streak.freezesOwned, 0);
  assert.equal(result.freezeUsed, true);
});

test("a freeze cannot rescue a two-day gap", () => {
  const streak: Streak = {
    current: 9,
    longest: 9,
    lastActiveDate: "2026-03-01",
    freezesOwned: 1,
  };
  const result = registerActivity(streak, "2026-03-04");
  assert.equal(result.streak.current, 1);
  assert.equal(result.streak.freezesOwned, 1, "an unusable freeze is not burned");
});

test("milestone days pay a bonus", () => {
  const streak: Streak = {
    current: 6,
    longest: 6,
    lastActiveDate: "2026-03-01",
    freezesOwned: 0,
  };
  assert.equal(registerActivity(streak, "2026-03-02").bonusXp, 25);
});

test("a clock roll-back cannot inflate the streak", () => {
  const streak: Streak = {
    current: 5,
    longest: 5,
    lastActiveDate: "2026-03-10",
    freezesOwned: 0,
  };
  const result = registerActivity(streak, "2026-03-04");
  assert.equal(result.streak.current, 5);
  assert.equal(result.extended, false);
});
