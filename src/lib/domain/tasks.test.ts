import assert from "node:assert/strict";
import { test } from "node:test";
import { isOverdue, matchesTaskFilter } from "./tasks";
import type { Task } from "./types";

const task: Task = { id: "task", title: "Task", priority: "medium", status: "open", dueDate: "2026-10-09", createdAt: "2026-10-08T10:00:00Z" };

test("unfinished no-time work becomes overdue at the next local midnight", () => {
  assert.equal(isOverdue(task, new Date(2026, 9, 9, 23, 59)), false);
  assert.equal(isOverdue(task, new Date(2026, 9, 10, 0, 0)), true);
});

test("a timed task becomes overdue after its scheduled block ends", () => {
  const timed = { ...task, dueTime: "09:00", durationMin: 30 };
  assert.equal(isOverdue(timed, new Date(2026, 9, 9, 9, 29)), false);
  assert.equal(isOverdue(timed, new Date(2026, 9, 9, 9, 30)), true);
});

test("blocks that cross midnight remain open until the block ends", () => {
  const timed = { ...task, dueTime: "23:30", durationMin: 60 };
  assert.equal(isOverdue(timed, new Date(2026, 9, 10, 0, 15)), false);
  assert.equal(isOverdue(timed, new Date(2026, 9, 10, 0, 30)), true);
});

test("done, future, and undated tasks are never overdue", () => {
  const now = new Date(2026, 9, 10, 12);
  assert.equal(isOverdue({ ...task, status: "done" }, now), false);
  assert.equal(isOverdue({ ...task, dueDate: "2026-10-11" }, now), false);
  assert.equal(isOverdue({ ...task, dueDate: undefined }, now), false);
});

test("calendar overdue and status filters share the same deadlines", () => {
  const now = new Date(2026, 9, 10, 12);
  assert.equal(matchesTaskFilter(task, "overdue", now), true);
  assert.equal(matchesTaskFilter({ ...task, status: "done" }, "overdue", now), false);
  assert.equal(matchesTaskFilter(task, "done", now), false);
  assert.equal(matchesTaskFilter(task, "open", now), true);
});
