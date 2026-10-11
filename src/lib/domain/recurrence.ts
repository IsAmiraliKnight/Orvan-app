import { addDays, parseLocalDate } from "./dates";
import type { LocalDate, Priority, Recurrence, Task } from "./types";

/**
 * Repeating tasks.
 *
 * Occurrences are materialised only as far as the UI has actually visited.
 * This makes tomorrow visible before today's task is complete without filling
 * storage with an arbitrary year of copies.
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

/**
 * Fill every scheduled occurrence through `through`, independently of task
 * completion. Returning the original array when nothing changed lets callers
 * use this safely from an effect without creating a render loop.
 *
 * Older saved data may already contain the successor that the previous model
 * created on completion. Dates are de-duplicated per series, so migrating that
 * data cannot create a second copy.
 */
export function materializeRecurrences(
  tasks: Task[],
  through: LocalDate,
  createId: () => string,
  createdAt: string,
): Task[] {
  const additions: Task[] = [];
  const roots = tasks.filter((task) => task.recurrence && !task.parentTaskId && (task.recurrenceStartDate || task.dueDate));

  for (const root of roots) {
    const existingDates = new Set(
      tasks
        .filter((task) => task.id === root.id || task.parentTaskId === root.id)
        .map((task) => task.occurrenceDate ?? task.dueDate)
        .filter((date): date is LocalDate => date !== undefined),
    );

    let occurrence = root.recurrenceStartDate ?? root.dueDate!;
    // A guard protects persisted data from ever turning a malformed recurrence
    // into an unbounded loop.
    for (let count = 0; occurrence < through && count < 10000; count += 1) {
      occurrence = nextOccurrence(occurrence, root.recurrence!);
      if (occurrence > through) break;
      if (existingDates.has(occurrence)) continue;

      existingDates.add(occurrence);
      additions.push({
        ...root,
        id: createId(),
        status: "open",
        completedAt: undefined,
        dueDate: occurrence,
        occurrenceDate: occurrence,
        parentTaskId: root.id,
        createdAt,
      });
    }
  }

  return additions.length === 0 ? tasks : [...tasks, ...additions];
}

/** Keep per-occurrence dates and completion history when editing a series. */
export function editTaskSeries(tasks: Task[], id: string, patch: Partial<Omit<Task, "id">>, day: LocalDate): Task[] {
  const target = tasks.find((task) => task.id === id);
  if (!target) return tasks;
  const rootId = target.parentTaskId ?? target.id;
  const root = tasks.find((task) => task.id === rootId) ?? target;
  const repeating = Boolean(root.recurrence);
  const changesSchedule = "recurrence" in patch && !sameRecurrence(root.recurrence, patch.recurrence);
  const nextPatch = {
    ...patch,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...((patch.recurrence ?? ("recurrence" in patch ? undefined : root.recurrence)) ? { priority: RECURRING_PRIORITY } : {}),
    ...("dueTime" in patch && !patch.dueTime ? { durationMin: undefined } : {}),
  };
  const shared = { ...nextPatch };
  delete shared.dueDate;
  delete shared.status;
  delete shared.completedAt;
  delete shared.createdAt;
  delete shared.occurrenceDate;
  delete shared.parentTaskId;
  delete shared.recurrenceStartDate;
  const belongs = (task: Task) => task.id === rootId || task.parentTaskId === rootId;

  return tasks
    .filter((task) => !(changesSchedule && belongs(task) && task.id !== rootId && task.id !== id && task.status === "open" && task.dueDate && task.dueDate > day))
    .map((task) => {
      let next = task.id === id
        ? { ...task, ...nextPatch }
        : (repeating || target.parentTaskId || patch.recurrence) && belongs(task) ? { ...task, ...shared } : task;
      if (task.id === rootId && (repeating || patch.recurrence)) {
        next = {
          ...next,
          recurrenceStartDate: changesSchedule
            ? patch.dueDate ?? day
            : root.recurrenceStartDate ?? root.dueDate ?? patch.dueDate ?? day,
          // Moving the root edits just that occurrence, not the series anchor.
          occurrenceDate: task.occurrenceDate ?? task.dueDate,
        };
      }
      return next;
    });
}
