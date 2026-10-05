"use client";

import { useEffect, useState } from "react";

import { ColorPicker } from "@/components/ColorPicker";
import { DatePicker, TimePicker } from "@/components/DateField";
import { today } from "@/lib/domain/dates";
import { RECURRENCES, recurrenceLabel, sameRecurrence } from "@/lib/domain/recurrence";
import type { LocalDate, Priority, Recurrence } from "@/lib/domain/types";
import { PRIORITY_XP, prioritySlotsLeft } from "@/lib/domain/xp";
import { useOrvan, type NewTaskInput } from "@/lib/store/store";

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };

/** Chips rather than a number field: nobody schedules 37 minutes. */
const DURATIONS: ReadonlyArray<readonly [number, string]> = [
  [15, "15m"],
  [30, "30m"],
  [45, "45m"],
  [60, "1h"],
  [120, "2h"],
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewTaskInput) => void;
  /** Pre-selects a day, so the sheet opens on whatever the page is showing. */
  defaultDate?: LocalDate;
  /** Set when the sheet was opened by drawing a slot on the calendar. */
  defaultTime?: string;
  defaultDurationMin?: number;
  defaultProjectId?: string;
}

export function AddTaskSheet({
  open,
  onClose,
  onSubmit,
  defaultDate,
  defaultTime,
  defaultDurationMin,
  defaultProjectId,
}: Props) {
  const { state } = useOrvan();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<LocalDate>(defaultDate ?? today());
  const [dueTime, setDueTime] = useState(defaultTime ?? "");
  const [durationMin, setDurationMin] = useState(defaultDurationMin ?? 60);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(undefined);
  const [colorKey, setColorKey] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(defaultProjectId);
  const [proNote, setProNote] = useState(false);

  /*
   * The sheet stays mounted between openings, so the "when" fields have to be
   * re-seeded on the way in. Without this, dragging a 09:00 slot on the
   * calendar after having dragged an 14:00 one would still open on 14:00.
   */
  useEffect(() => {
    if (!open) return;
    setDueDate(defaultDate ?? today());
    setDueTime(defaultTime ?? "");
    setDurationMin(defaultDurationMin ?? 60);
  }, [open, defaultDate, defaultTime, defaultDurationMin]);

  if (!open) return null;

  const day = today();
  const repeating = recurrence !== undefined;

  function slotsLabel(p: Priority): string | null {
    const left = prioritySlotsLeft(state.xpEvents, day, p);
    if (left === Number.POSITIVE_INFINITY) return null;
    return `${left} left`;
  }

  const exhausted = prioritySlotsLeft(state.xpEvents, day, priority) <= 0;
  const active = state.projects.filter((p) => p.status === "active");

  function submit() {
    if (!title.trim()) return;
    onSubmit({
      title,
      priority,
      dueDate,
      dueTime: dueTime || undefined,
      durationMin,
      colorKey,
      projectId,
      recurrence,
    });
    setTitle("");
    setPriority("medium");
    setDueDate(defaultDate ?? today());
    setDueTime(defaultTime ?? "");
    setDurationMin(defaultDurationMin ?? 60);
    setRecurrence(undefined);
    setColorKey(undefined);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-shade/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="animate-pop-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="What needs doing?"
          className="w-full rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:ring-1 focus:ring-accent"
        />

        <p className="mb-2 mt-4 text-xs text-ink-dim">When</p>
        <div className="flex gap-2">
          <DatePicker value={dueDate} onChange={setDueDate} />
          <TimePicker value={dueTime} onChange={setDueTime} />
        </div>

        {/* Duration is only a question once there is a start. An "anytime"
            task has nothing to be long. */}
        {dueTime && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* A range drawn on the grid rarely lands on a preset. It keeps its
                own chip rather than being silently rounded to one. */}
            {!DURATIONS.some(([mins]) => mins === durationMin) && (
              <Chip label={lengthLabel(durationMin)} on onClick={() => undefined} />
            )}
            {DURATIONS.map(([mins, label]) => (
              <Chip
                key={mins}
                label={label}
                on={durationMin === mins}
                onClick={() => setDurationMin(mins)}
              />
            ))}
            <span className="self-center ps-1 text-[11px] text-ink-faint tabular-nums">
              ends {endLabel(dueTime, durationMin)}
            </span>
          </div>
        )}

        <p className="mb-2 mt-4 text-xs text-ink-dim">Repeat</p>
        <div className="flex flex-wrap gap-1.5">
          {RECURRENCES.map(([label, r]) => (
            <Chip
              key={label}
              label={label}
              on={sameRecurrence(recurrence, r)}
              onClick={() => setRecurrence(r)}
            />
          ))}
        </div>

        <p className="mb-2 mt-4 text-xs text-ink-dim">Category</p>
        <ColorPicker value={colorKey} onChange={setColorKey} onLocked={() => setProNote(true)} />
        {proNote && (
          <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-p-med">
            That colour is part of Pro. The five free ones cover most setups.
          </p>
        )}

        {active.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs text-ink-dim">Project</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="None" on={!projectId} onClick={() => setProjectId(undefined)} />
              {active.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  on={projectId === p.id}
                  onClick={() => setProjectId(p.id)}
                />
              ))}
            </div>
          </>
        )}

        <p className="mb-2 mt-4 text-xs text-ink-dim">Priority</p>
        {repeating ? (
          /*
           * Priority is not offered on a repeat. It always pays Medium, and a
           * disabled row of buttons would only invite the question of why.
           */
          <p className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2.5 text-[11px] leading-relaxed text-accent-soft">
            <span className="font-medium">{recurrenceLabel(recurrence)}</span> — repeats pay the
            Medium rate, +{PRIORITY_XP.medium} XP each time. The next one appears as soon as you
            tick this one off.
          </p>
        ) : (
          <div className="flex gap-2">
            {PRIORITIES.map((p) => {
              const left = slotsLabel(p);
              const on = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                    on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-dim hover:text-ink"
                  }`}
                >
                  <span className="block font-medium">{LABEL[p]}</span>
                  <span className={on ? "text-on-accent/70" : "text-ink-faint"}>
                    +{PRIORITY_XP[p]} XP{left ? ` · ${left}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!repeating && exhausted && (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-p-med">
            You&apos;ve used every {LABEL[priority]} slot today. This task still gets added — it
            just won&apos;t earn XP. Bump something down?
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-40"
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}

/** 90 → "1h 30m". */
function lengthLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : ""].filter(Boolean).join(" ");
}

/** "09:15" + 90 → "10:45". Wraps at midnight rather than reading "25:00". */
export function endLabel(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-[10rem] truncate rounded-full px-3 py-1.5 text-[11px] transition-colors ${
        on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
