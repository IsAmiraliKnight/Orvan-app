"use client";

import { RepeatGlyph } from "@/components/ui";
import { relativeLabel } from "@/components/DateField";
import { swatch, tint } from "@/lib/domain/palette";
import { isOverdue } from "@/lib/domain/tasks";
import type { Priority, Task } from "@/lib/domain/types";
import { useOrvan } from "@/lib/store/store";

const PRIORITY_STYLE: Record<Priority, { dot: string; label: string }> = {
  high: { dot: "bg-p-high", label: "High" },
  medium: { dot: "bg-p-med", label: "Med" },
  low: { dot: "bg-p-low", label: "Low" },
};

interface Props {
  task: Task;
  projectName?: string;
  projectColor?: string;
  flash?: string;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskRow({ task, projectName, projectColor, flash, onToggle, onEdit, onDelete }: Props) {
  const { now } = useOrvan();
  const done = task.status === "done";
  const overdue = isOverdue(task, now);
  const style = PRIORITY_STYLE[task.priority];
  const category = swatch(task.colorKey);

  return (
    <li className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2"
      style={category && !done ? { backgroundColor: tint(category.color, 8) } : undefined}>
      {category && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full"
        style={{ background: category.color, opacity: done ? 0.35 : 1 }} title={category.name} aria-hidden="true" />}
      <button type="button" onClick={() => onToggle(task.id)} aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${done ? "border-accent bg-accent text-on-accent" : "border-line hover:border-ink-dim"}`}>
        {done && <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="M2.5 6.2 L4.8 8.5 L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>}
      </button>
      <button type="button" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}
        className="min-w-0 flex-1 text-start">
        <span className="flex min-w-0 items-start gap-2">
          <span className={`mt-2 size-1.5 shrink-0 rounded-full ${style.dot}`} title={style.label} aria-hidden="true" />
          {task.recurrence && <RepeatGlyph className="mt-1 size-3.5 shrink-0 text-accent-soft" />}
          <span className={`min-w-0 break-words text-sm ${done ? "text-ink-faint line-through" : "text-ink"}`}>{task.title}</span>
        </span>
        {(task.dueTime || projectName || overdue || !task.dueDate) && <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 ps-3.5 text-[10px]">
          {overdue ? <span className="text-p-high">Overdue · {relativeLabel(task.dueDate!)}{task.dueTime ? ` · ${task.dueTime}` : ""}</span>
            : task.dueTime && <span className="text-ink-faint tabular-nums">{task.dueTime}</span>}
          {!task.dueDate && <span className="text-ink-faint">No date</span>}
          {projectName && <span className="max-w-48 truncate rounded-full px-2 py-0.5"
            style={{ color: projectColor, backgroundColor: projectColor ? tint(projectColor, 12) : undefined }}>{projectName}</span>}
        </span>}
      </button>
      <button type="button" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}
        className="grid size-6 shrink-0 place-items-center rounded-md text-ink-faint transition-opacity hover:bg-p-high/10 hover:text-p-high focus:opacity-100 md:opacity-0 md:group-hover:opacity-100">
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {flash && <span className="animate-xp-float pointer-events-none absolute right-10 top-1 text-xs font-medium text-accent">{flash}</span>}
    </li>
  );
}
