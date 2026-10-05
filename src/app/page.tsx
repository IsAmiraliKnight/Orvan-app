"use client";

import { useEffect, useMemo, useState } from "react";

import { AddTaskSheet } from "@/components/AddTaskSheet";
import { DatePicker, relativeLabel } from "@/components/DateField";
import { HomeRail } from "@/components/HomeRail";
import { LevelUpModal } from "@/components/LevelUpModal";
import { TaskRow } from "@/components/TaskRow";
import { TopBar } from "@/components/TopBar";
import { addDays, parseLocalDate, toLocalDate, today } from "@/lib/domain/dates";
import type { LocalDate, Project, Task } from "@/lib/domain/types";
import { DAILY_TASK_XP_CAP } from "@/lib/domain/xp";
import { sortTasks, useOrvan } from "@/lib/store/store";

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

/**
 * How long a ticked row stays where it was before moving to Done. Long enough
 * to read the check and the XP that floats off it, short enough that it does
 * not feel like the app is ignoring you.
 */
const HOLD_MS = 1200;

/** Offsets from today, in the order the tabs read left to right. */
const TABS: ReadonlyArray<readonly [number, string]> = [
  [-1, "Yesterday"],
  [0, "Today"],
  [1, "Tomorrow"],
  [2, "In 2 days"],
];

interface SectionProps {
  label: string;
  tone?: "default" | "warn";
  tasks: Task[];
  projects: Project[];
  flash: { id: string; text: string } | null;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

function Section({
  label,
  tone = "default",
  tasks,
  projects,
  flash,
  onToggle,
  onEdit,
  onDelete,
}: SectionProps) {
  if (tasks.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-2">
      <h2 className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-widest">
        <span className={tone === "warn" ? "text-p-high" : "text-ink-faint"}>{label}</span>
        <span className="text-ink-faint/60 tabular-nums">{tasks.length}</span>
      </h2>
      <ul>
        {tasks.map((t) => {
          const project = projects.find((p) => p.id === t.projectId);
          return (
            <TaskRow
              key={t.id}
              task={t}
              projectName={project?.name}
              projectColor={project?.color}
              flash={flash?.id === t.id ? flash.text : undefined}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </ul>
    </section>
  );
}

export default function HomePage() {
  const {
    state,
    ready,
    addTask,
    updateTask,
    ensureRecurringTasksThrough,
    completeTask,
    reopenTask,
    deleteTask,
  } = useOrvan();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ id: string; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Ids ticked in the last moment, still shown in the list they were ticked in. */
  const [justDone, setJustDone] = useState<ReadonlySet<string>>(() => new Set());

  const day = today();
  const [viewDate, setViewDate] = useState<LocalDate>(day);
  const isToday = viewDate === day;

  // Keep the fixed day tabs populated even before somebody completes today's
  // occurrence. Custom dates extend the materialised range on demand.
  useEffect(() => {
    if (!ready) return;
    ensureRecurringTasksThrough(viewDate > addDays(day, 2) ? viewDate : addDays(day, 2));
  }, [ready, day, viewDate, state.tasks, ensureRecurringTasksThrough]);

  const { overdue, open, done } = useMemo(() => {
    const forDay = state.tasks.filter((t) => (t.dueDate ?? day) === viewDate);
    /*
     * A task you just ticked keeps its place in the open list for a beat before
     * moving. Without it the row is unmounted on the same frame as the click,
     * and the tick you just made is never actually drawn where you made it.
     */
    const held = (t: Task) => justDone.has(t.id);
    return {
      // Only ever surfaced on Today: on a future day an unfinished past task is
      // not "overdue relative to what you are looking at", it is just noise.
      overdue: isToday
        ? sortTasks(
            state.tasks.filter(
              (t) => t.dueDate && t.dueDate < day && (t.status === "open" || held(t)),
            ),
          )
        : [],
      open: sortTasks(forDay.filter((t) => t.status === "open" || held(t))),
      /*
       * Anything finished *for* this day, plus — when looking at today —
       * anything finished *on* it. Without the second half, completing an
       * overdue task dropped it out of every section at once: it left Overdue
       * because it was no longer open, and never reached Done because its due
       * date belonged to a different day.
       */
      done: state.tasks.filter(
        (t) =>
          t.status === "done" &&
          !held(t) &&
          ((t.dueDate ?? day) === viewDate ||
            (isToday && t.completedAt !== undefined && toLocalDate(new Date(t.completedAt)) === day)),
      ),
    };
  }, [state.tasks, day, viewDate, isToday, justDone]);

  function handleToggle(id: string) {
    const task = state.tasks.find((t) => t.id === id);
    if (task?.status === "done") {
      reopenTask(id);
      // Un-ticking during the hold has to release it too, or the row would sit
      // in the open list already looking open and then jump a second time.
      setJustDone((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    const result = completeTask(id);
    if (!result) return;

    setJustDone((prev) => new Set(prev).add(id));
    setTimeout(
      () =>
        setJustDone((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      HOLD_MS,
    );

    // A floating "+0 XP" reads as a bug; the toast explains why instead.
    if (result.xp > 0 || result.bonusXp > 0) {
      const parts = [];
      if (result.xp > 0) parts.push(`+${result.xp} XP`);
      if (result.bonusXp > 0) parts.push(`+${result.bonusXp} streak`);
      setFlash({ id, text: parts.join("  ") });
      setTimeout(() => setFlash(null), 1100);
    }

    if (result.reason === "priority_limit") {
      setToast("No XP — every slot for that priority is used up today.");
    } else if (result.reason === "daily_cap") {
      setToast(`Daily task XP cap reached (${DAILY_TASK_XP_CAP}). Quests still pay out.`);
    }
    if (result.reason !== "full") {
      setTimeout(() => setToast(null), 3200);
    }

    if (result.leveledUpTo) setLevelUp(result.leveledUpTo);
  }

  function quickAdd() {
    if (!quickTitle.trim()) return;
    addTask({ title: quickTitle, priority: "medium", dueDate: viewDate });
    setQuickTitle("");
  }

  if (!ready) {
    return <div className="flex-1 animate-pulse bg-bg" aria-label="Loading" />;
  }

  const isEmpty = overdue.length + open.length + done.length === 0;
  const custom = !TABS.some(([offset]) => addDays(day, offset) === viewDate);

  return (
    <>
      <TopBar
        title={relativeLabel(viewDate, day)}
        subtitle={LONG_DATE.format(parseLocalDate(viewDate))}
        action={
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-on-accent transition-opacity hover:opacity-90 sm:px-3.5"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ New task</span>
          </button>
        }
      />

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-4">
          {/*
            Four fixed days cover almost every look-up; the picker is there for
            the rest rather than making people step through a week to reach it.
          */}
          <div className="flex items-center gap-2">
            <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1">
              {TABS.map(([offset, label]) => {
                const d = addDays(day, offset);
                const on = viewDate === d;
                const count = state.tasks.filter(
                  (t) => (t.dueDate ?? day) === d && t.status === "open",
                ).length;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setViewDate(d)}
                    aria-pressed={on}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition-colors ${
                      on
                        ? "bg-accent font-medium text-on-accent"
                        : "bg-surface text-ink-dim hover:text-ink"
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                          on ? "bg-on-accent/15" : "bg-surface-2 text-ink-faint"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              {custom && (
                <span className="flex shrink-0 items-center rounded-full bg-accent px-3.5 py-2 text-xs font-medium text-on-accent">
                  {relativeLabel(viewDate, day)}
                </span>
              )}
            </div>
            <div className="w-32 shrink-0">
              <DatePicker value={viewDate} onChange={setViewDate} label="Pick a day" />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 focus-within:border-accent/50">
            <span className="text-ink-faint" aria-hidden="true">
              +
            </span>
            <input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickAdd()}
              placeholder={
                isToday ? "Add a task and press Enter…" : `Add to ${relativeLabel(viewDate, day)}…`
              }
              aria-label="Quick add task"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
            >
              Options
            </button>
          </div>

          {isEmpty ? (
            <div className="rounded-2xl border border-dashed border-line py-20 text-center">
              <p className="text-4xl" aria-hidden="true">
                🌱
              </p>
              <p className="mt-3 text-sm text-ink-dim">
                Nothing on {relativeLabel(viewDate, day).toLowerCase()}.
              </p>
              <p className="mt-1 text-sm text-ink-faint">Add something, or take the win.</p>
            </div>
          ) : (
            <>
              <Section
                label="Overdue"
                tone="warn"
                tasks={overdue}
                projects={state.projects}
                flash={flash}
                onToggle={handleToggle}
                onEdit={setEditingTask}
                onDelete={deleteTask}
              />
              <Section
                label={relativeLabel(viewDate, day)}
                tasks={open}
                projects={state.projects}
                flash={flash}
                onToggle={handleToggle}
                onEdit={setEditingTask}
                onDelete={deleteTask}
              />
              <Section
                label="Done"
                tasks={done}
                projects={state.projects}
                flash={flash}
                onToggle={handleToggle}
                onEdit={setEditingTask}
                onDelete={deleteTask}
              />
            </>
          )}
        </div>

        {/* The rail follows the day tabs — a summary pinned to today sitting
            next to tomorrow's list would be read as tomorrow's. */}
        <HomeRail date={viewDate} label={relativeLabel(viewDate, day)} />
      </div>

      {toast && (
        <div
          role="status"
          className="animate-pop-in fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 z-40 md:bottom-8 w-[min(24rem,90vw)] -translate-x-1/2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-center text-xs text-ink-dim shadow-xl shadow-shade/25"
        >
          {toast}
        </div>
      )}

      <AddTaskSheet
        open={sheetOpen || editingTask !== null}
        onClose={() => {
          setSheetOpen(false);
          setEditingTask(null);
        }}
        onSubmit={(input) => {
          if (editingTask) updateTask(editingTask.id, input);
          else addTask(input);
        }}
        defaultDate={viewDate}
        task={editingTask ?? undefined}
      />
      <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
    </>
  );
}
