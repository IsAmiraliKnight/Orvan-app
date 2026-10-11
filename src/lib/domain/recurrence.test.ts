import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isoWeekday,
  materializeRecurrences,
  nextOccurrence,
  recurrenceLabel,
  sameRecurrence,
  editTaskSeries,
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

function dailyTask(): Task {
  return { id: "daily", title: "Project routine", priority: "medium", status: "open", dueDate: MONDAY,
    dueTime: "09:00", durationMin: 30, projectId: "project", recurrence: { kind: "daily" }, createdAt: "2026-03-02T08:00:00.000Z" };
}

test("a whole month of project routines exists while the first is still open", () => {
  let id = 0;
  const root = dailyTask();
  const tasks = materializeRecurrences([root], "2026-03-31", () => `day-${++id}`, root.createdAt);
  assert.equal(tasks.length, 30);
  assert.ok(tasks.every((t) => t.status === "open" && t.projectId === "project" && t.dueTime === "09:00"));
  assert.equal(tasks.at(-1)?.dueDate, "2026-03-31");
});

test("catch-up preserves missed days and completed history independently", () => {
  let id = 0;
  const root = { ...dailyTask(), status: "done" as const, completedAt: "2026-03-02T09:30:00.000Z" };
  const tasks = materializeRecurrences([root], "2026-03-09", () => `day-${++id}`, root.createdAt);
  assert.equal(tasks[0], root);
  assert.equal(tasks.filter((t) => t.status === "open").length, 7);
  assert.equal(tasks[1].completedAt, undefined);
});

test("weekday project routines fill all five weekdays without waiting for a check", () => {
  let id = 0;
  const root = { ...dailyTask(), recurrence: { kind: "weekdays" as const } };
  const tasks = materializeRecurrences([root], "2026-03-08", () => `day-${++id}`, root.createdAt);
  assert.deepEqual(tasks.map((t) => t.dueDate), [MONDAY, "2026-03-03", "2026-03-04", "2026-03-05", FRIDAY]);
});

test("removing a series time clears durations and preserves each day and completion", () => {
  let id = 0;
  const root = dailyTask();
  const tasks = materializeRecurrences([root], "2026-03-04", () => `day-${++id}`, root.createdAt);
  tasks[1] = { ...tasks[1], status: "done", completedAt: "2026-03-03T09:30:00.000Z" };
  const edited = editTaskSeries(tasks, tasks[2].id, { dueTime: undefined }, "2026-03-04");
  assert.deepEqual(edited.map((t) => t.dueDate), tasks.map((t) => t.dueDate));
  assert.ok(edited.every((t) => !t.dueTime && !t.durationMin));
  assert.equal(edited[1].completedAt, tasks[1].completedAt);
});

test("stopping a routine removes future open copies and retains its history", () => {
  let id = 0;
  const root = dailyTask();
  const tasks = materializeRecurrences([root], "2026-03-08", () => `day-${++id}`, root.createdAt);
  tasks[1] = { ...tasks[1], status: "done", completedAt: "2026-03-03T09:30:00.000Z" };
  const edited = editTaskSeries(tasks, tasks[2].id, { recurrence: undefined }, "2026-03-04");
  assert.deepEqual(edited.map((t) => t.dueDate), [MONDAY, "2026-03-03", "2026-03-04"]);
  assert.equal(edited[1].status, "done");
  assert.equal(materializeRecurrences(edited, "2026-03-31", () => "unexpected", root.createdAt), edited);
});

test("moving the first occurrence keeps the original routine anchor", () => {
  let id = 0;
  const root = dailyTask();
  const tasks = materializeRecurrences([root], "2026-03-04", () => `day-${++id}`, root.createdAt);
  const edited = editTaskSeries(tasks, root.id, { dueDate: "2026-03-12" }, MONDAY);
  const expanded = materializeRecurrences(edited, "2026-03-06", () => `day-${++id}`, root.createdAt);
  assert.deepEqual(expanded.map((t) => t.dueDate), ["2026-03-12", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]);
  assert.equal(expanded[0].occurrenceDate, MONDAY);
});

test("untimed routines remain untimed when expanded into a week", () => {
  let id = 0;
  const root = { ...dailyTask(), dueTime: undefined, durationMin: undefined };
  const tasks = materializeRecurrences([root], "2026-03-08", () => `day-${++id}`, root.createdAt);
  assert.equal(tasks.length, 7);
  assert.ok(tasks.every((t) => !t.dueTime));
});

test("a stopped series can resume from an existing occurrence", () => {
  let id = 0;
  const root = dailyTask();
  const tasks = materializeRecurrences([root], "2026-03-08", () => `day-${++id}`, root.createdAt);
  const stopped = editTaskSeries(tasks, tasks[2].id, { recurrence: undefined }, "2026-03-04");
  const resumed = editTaskSeries(stopped, tasks[2].id, { recurrence: { kind: "daily" }, dueDate: "2026-03-04" }, "2026-03-04");
  const expanded = materializeRecurrences(resumed, "2026-03-06", () => `day-${++id}`, root.createdAt);
  assert.deepEqual(expanded.map((t) => t.dueDate), [MONDAY, "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]);
});
