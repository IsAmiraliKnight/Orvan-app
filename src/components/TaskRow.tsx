"use client";

import { RepeatGlyph } from "@/components/ui";
import { swatch, tint } from "@/lib/domain/palette";
import type { Priority, Task } from "@/lib/domain/types";

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
  onDelete: (id: string) => void;
}

export function TaskRow({
  task,
  projectName,
  projectColor,
  flash,
  onToggle,
  onDelete,
}: Props) {
  const done = task.status === "done";
  const style = PRIORITY_STYLE[task.priority];
  const category = swatch(task.colorKey);

  return (
    <li
      className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2"
      style={
        // A wash rather than a block: the row still has to sit inside a card,
        // and 8% keeps the text contrast the theme already guarantees.
        category && !done
          ? { backgroundColor: tint(category.color, 8) }
          : undefined
      }
    >
      {category && (
        <span
          className="absolute inset-y-2 start-0 w-[3px] rounded-full"
          style={{ background: category.color, opacity: done ? 0.35 : 1 }}
          title={category.name}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
          done
            ? "border-accent bg-accent text-on-accent"
            : "border-line hover:border-ink-dim"
        }`}
      >
        {done && (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
            <path
              d="M2.5 6.2 L4.8 8.5 L9.5 3.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <span
        className={`size-1.5 shrink-0 rounded-full ${style.dot}`}
        title={style.label}
        aria-hidden="true"
      />

      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {task.recurrence && (
          <RepeatGlyph className="size-3.5 text-accent-soft" />
        )}
        <span
          className={`min-w-0 truncate text-sm ${
            done ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {task.title}
        </span>
        {task.dueTime && (
          <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">{task.dueTime}</span>
        )}
      </span>

      {projectName && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px]"
          style={{
            color: projectColor,
            backgroundColor: `color-mix(in srgb, ${projectColor} 16%, transparent)`,
          }}
        >
          {projectName}
        </span>
      )}

      <button
        type="button"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete ${task.title}`}
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

      {flash && (
        <span className="animate-xp-float pointer-events-none absolute right-10 top-1 text-xs font-medium text-accent">
          {flash}
        </span>
      )}
    </li>
  );
}
