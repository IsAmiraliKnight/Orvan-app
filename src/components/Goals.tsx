"use client";

import { useState } from "react";

import { DatePicker, relativeLabel } from "@/components/DateField";
import { daysBetween, today } from "@/lib/domain/dates";
import type { Goal, GoalArea } from "@/lib/domain/types";
import { useOrvan } from "@/lib/store/store";

const AREAS: ReadonlyArray<readonly [GoalArea, string, string]> = [
  ["work", "Work", "💼"],
  ["health", "Health", "🩺"],
  ["money", "Money", "◎"],
  ["learning", "Learning", "📚"],
  ["life", "Life", "🌿"],
];

const AREA_COLOR: Record<GoalArea, string> = {
  work: "var(--color-chart-1)",
  health: "var(--color-chart-5)",
  money: "var(--color-chart-4)",
  learning: "var(--color-chart-2)",
  life: "var(--color-chart-3)",
};

/**
 * The long-horizon list. Deliberately not connected to XP: a goal is the thing
 * the daily loop is *for*, and scoring it would turn a five-year intention into
 * another number to farm.
 */
export function Goals() {
  const { state, addGoal, updateGoal, deleteGoal } = useOrvan();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<GoalArea>("work");
  const [targetDate, setTargetDate] = useState(today());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addGoal({ title, area, targetDate });
    setTitle("");
    setAdding(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">
            Long-term goals
          </h2>
          <p className="mt-1 text-xs text-ink-dim">
            The things the daily loop is in service of.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="shrink-0 rounded-lg bg-surface-2 px-3 py-1.5 text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="animate-pop-in mb-4 rounded-xl bg-surface-2 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to be true a year from now?"
            aria-label="Goal"
            className="w-full border-b border-line bg-transparent pb-2 text-sm outline-none placeholder:text-ink-faint focus:border-accent"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {AREAS.map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setArea(key)}
                className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                  area === key ? "bg-accent text-on-accent" : "bg-surface text-ink-dim hover:text-ink"
                }`}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="w-36 shrink-0">
              <DatePicker value={targetDate} onChange={setTargetDate} label="Target date" />
            </span>
            <button
              type="submit"
              disabled={!title.trim()}
              className="ms-auto rounded-lg bg-accent px-4 py-2 text-xs font-medium text-on-accent disabled:opacity-40"
            >
              Add goal
            </button>
          </div>
        </form>
      )}

      {state.goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink-faint">
          No goals yet. Write down one thing worth a year.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {state.goals.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              onProgress={(progress) => updateGoal(g.id, { progress })}
              onDelete={() => deleteGoal(g.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function GoalRow({
  goal,
  onProgress,
  onDelete,
}: {
  goal: Goal;
  onProgress: (p: number) => void;
  onDelete: () => void;
}) {
  const meta = AREAS.find(([key]) => key === goal.area);
  const color = AREA_COLOR[goal.area];
  const left = goal.targetDate ? daysBetween(today(), goal.targetDate) : null;

  return (
    <li className="group">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg text-xs"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
          aria-hidden="true"
        >
          {meta?.[2]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{goal.title}</span>
          <span className="block text-[11px] text-ink-faint">
            {meta?.[1]}
            {goal.targetDate && (
              <>
                {" · "}
                {left !== null && left >= 0
                  ? `${left} days left`
                  : `overdue · ${relativeLabel(goal.targetDate)}`}
              </>
            )}
          </span>
        </span>
        <span className="w-9 shrink-0 text-end text-xs tabular-nums" style={{ color }}>
          {goal.progress}%
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${goal.title}`}
          className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-p-high focus:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Moved by hand. Auto-derived progress would need the goal to be broken
          into tasks first, which is a bigger idea than this section is. */}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={goal.progress}
        onChange={(e) => onProgress(Number(e.target.value))}
        aria-label={`Progress on ${goal.title}`}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent"
        style={{
          background: `linear-gradient(to right, ${color} ${goal.progress}%, var(--color-surface-3) ${goal.progress}%)`,
        }}
      />
    </li>
  );
}
