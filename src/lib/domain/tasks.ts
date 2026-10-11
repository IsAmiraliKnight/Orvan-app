import { parseLocalDate } from "./dates";
import type { Task } from "./types";

/** Undated tasks have no deadline; timed blocks become overdue when they end. */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  const deadline = parseLocalDate(task.dueDate);
  if (task.dueTime) {
    const [hours, minutes] = task.dueTime.split(":").map(Number);
    deadline.setHours(hours, minutes + (task.durationMin ?? 60), 0, 0);
  } else {
    deadline.setDate(deadline.getDate() + 1);
  }
  return now.getTime() >= deadline.getTime();
}

export type TaskFilter = "all" | "open" | "done" | "overdue";

export function matchesTaskFilter(task: Task, filter: TaskFilter, now: Date): boolean {
  if (filter === "overdue") return isOverdue(task, now);
  return filter === "all" || task.status === filter;
}
