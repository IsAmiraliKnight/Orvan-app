import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isoWeekday,
  materializeRecurrences,
  nextOccurrence,
  recurrenceLabel,
  sameRecurrence,
} from "./recurrence";
import type { LocalDate, Task } from "./types";

/** 2026-03-02 is a Monday, which makes the weekend cases readable. */
const MONDAY: LocalDate = "2026-03-02";
const FRIDAY: LocalDate = "2026-03-06";
const SATURDAY: LocalDate = "2026-03-07";

test("iso weekday is Monday-anchored", () => {
  assert.equal(isoWeekday(MONDAY), 1);
  assert.equal(isoWeekday(FRIDAY), 5);
  assert.equal(isoWeekday("2026-03-08"), 7);
});

test("daily steps one day", () => {
  assert.equal(nextOccurrence(MONDAY, { kind: "daily" }), "2026-03-03");
});

test("weekly keeps the weekday", () => {
  const next = nextOccurrence(MONDAY, { kind: "weekly", weekday: 1 });
  assert.equal(next, "2026-03-09");
  assert.equal(isoWeekday(next), isoWeekday(MONDAY));
});

test("weekdays skips the weekend from Friday", () => {
  assert.equal(nextOccurrence(FRIDAY, { kind: "weekdays" }), "2026-03-09");
});

test("weekdays lands on Monday even when finished on a Saturday", () => {
  assert.equal(nextOccurrence(SATURDAY, { kind: "weekdays" }), "2026-03-09");
});

test("weekdays steps normally mid-week", () => {
  assert.equal(nextOccurrence(MONDAY, { kind: "weekdays" }), "2026-03-03");
});

test("labels round-trip", () => {
  assert.equal(recurrenceLabel(undefined), "Never");
  assert.equal(recurrenceLabel({ kind: "weekdays" }), "Weekdays");
});

test("same recurrence compares the weekday too", () => {
  assert.equal(sameRecurrence(undefined, undefined), true);
  assert.equal(sameRecurrence({ kind: "daily" }, { kind: "daily" }), true);
  assert.equal(sameRecurrence({ kind: "daily" }, undefined), false);
  assert.equal(
    sameRecurrence({ kind: "weekly", weekday: 1 }, { kind: "weekly", weekday: 4 }),
    false,
  );
});

test("daily occurrences exist through the requested day without completing the first", () => {
  const root: Task = {
    id: "root",
    title: "Read",
    priority: "medium",
    status: "open",
    dueDate: MONDAY,
    recurrence: { kind: "daily" },
    createdAt: "2026-03-02T08:00:00.000Z",
  };
  let id = 0;
  const expanded = materializeRecurrences(
    [root],
    "2026-03-04",
    () => `copy-${++id}`,
    "2026-03-02T08:00:00.000Z",
  );

  assert.deepEqual(
    expanded.map((task) => task.dueDate),
    ["2026-03-02", "2026-03-03", "2026-03-04"],
  );
  assert.equal(expanded[1].parentTaskId, root.id);
  assert.equal(expanded[2].status, "open");
});

test("materialising recurring tasks does not duplicate an existing saved occurrence", () => {
  const root: Task = {
    id: "root",
    title: "Read",
    priority: "medium",
    status: "done",
    dueDate: MONDAY,
    recurrence: { kind: "daily" },
    createdAt: "2026-03-02T08:00:00.000Z",
  };
  const existing: Task = {
    ...root,
    id: "existing",
    status: "open",
    completedAt: undefined,
    dueDate: "2026-03-03",
    occurrenceDate: "2026-03-03",
    parentTaskId: root.id,
  };
  const expanded = materializeRecurrences(
    [root, existing],
    "2026-03-03",
    () => "duplicate",
    root.createdAt,
  );

  assert.equal(expanded.length, 2);
  assert.equal(expanded, materializeRecurrences(expanded, "2026-03-03", () => "x", root.createdAt));
});
