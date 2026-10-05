"use client";

import { useEffect, useMemo, useState } from "react";

import { AddTaskSheet } from "@/components/AddTaskSheet";
import { ColorPicker } from "@/components/ColorPicker";
import { DatePicker, TimePicker, relativeLabel } from "@/components/DateField";
import { Avatar, Bar, RepeatGlyph, Ring } from "@/components/ui";
import { today } from "@/lib/domain/dates";
import { swatch, tint } from "@/lib/domain/palette";
import { RECURRENCES, sameRecurrence } from "@/lib/domain/recurrence";
import type { Priority, Project, Recurrence, Task } from "@/lib/domain/types";
import { useOrvan } from "@/lib/store/store";

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const SWATCHES = ["#2ea98c", "#57d7b5", "#ffc53d", "#ff7a45", "#7c9cff", "#c98cff"];

/** Where the indent stops growing — past this the outline is a diagram. */
const MAX_DEPTH = 3;

/**
 * Project detail as a modal, not a route and not a drawer.
 *
 * `/projects/[id]` would need `generateStaticParams`, and the ids here are
 * created by the user at runtime — there is no set of them to enumerate at
 * build time. A centred dialog rather than a side drawer because the content
 * is an outline: it wants width for the indent levels, and the board behind it
 * is context rather than something to keep working in.
 */
export function ProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const { state, addTask, updateTask, completeTask, reopenTask, deleteTask, updateProject } =
    useOrvan();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState(today());
  const [dueTime, setDueTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(undefined);
  const [colorKey, setColorKey] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  /** The row currently showing its "add a sub-task" input. */
  const [addingUnder, setAddingUnder] = useState<string | null>(null);

  /**
   * Whether the composer is showing its options.
   *
   * Only below `lg`. On a phone the form is the first thing in the dialog, and
   * fully open it is a whole screen of pickers standing between you and the
   * outline you came to read — so it collapses to the one field that is always
   * needed, and the rest is a step you take when you want it. On a desktop it
   * sits in its own column beside the outline and costs nothing, so it stays
   * open and this is ignored.
   */
  const [options, setOptions] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && !renaming && !editingTask && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, renaming, editingTask]);

  const tasks = useMemo(
    () => state.tasks.filter((t) => t.projectId === project.id),
    [state.tasks, project.id],
  );

  /*
   * The outline. A `parentId` pointing outside this project — the parent was
   * deleted, or moved to another board — is treated as no parent at all, so a
   * sub-task can never be stranded where nothing draws it.
   */
  const { roots, children } = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.id));
    const kids = new Map<string, Task[]>();
    const top: Task[] = [];

    for (const t of tasks) {
      const parent = t.parentId && ids.has(t.parentId) ? t.parentId : undefined;
      if (parent) kids.set(parent, [...(kids.get(parent) ?? []), t]);
      else top.push(t);
    }

    // Finished work sinks to the bottom of its own level rather than leaving
    // the outline — a sub-task that vanished would look like a deletion.
    const order = (list: Task[]) =>
      [...list].sort(
        (a, b) =>
          Number(a.status === "done") - Number(b.status === "done") ||
          a.createdAt.localeCompare(b.createdAt),
      );

    for (const [id, list] of kids) kids.set(id, order(list));
    return { roots: order(top), children: kids };
  }, [tasks]);

  const done = tasks.filter((t) => t.status === "done");
  const open = tasks.filter((t) => t.status === "open");
  const pct = tasks.length === 0 ? 0 : done.length / tasks.length;

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({
      title,
      priority,
      dueDate,
      dueTime: dueTime || undefined,
      colorKey,
      projectId: project.id,
      recurrence,
    });
    setTitle("");
    setDueTime("");
  }

  function addSub(parent: Task, subtitle: string) {
    if (!subtitle.trim()) return;
    addTask({
      title: subtitle,
      // A sub-task inherits the parent's colour and day, so breaking a task
      // down does not turn into a second round of form-filling.
      priority: parent.priority,
      dueDate: parent.dueDate,
      colorKey: parent.colorKey,
      projectId: project.id,
      parentId: parent.id,
    });
  }

  function commitName() {
    const next = name.trim();
    if (next) updateProject(project.id, { name: next });
    else setName(project.name);
    setRenaming(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-shade/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={project.name}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-line bg-bg shadow-2xl shadow-shade/50 sm:max-h-[88dvh] sm:rounded-2xl"
      >
        <header
          className="shrink-0 border-b border-line px-5 py-4"
          style={{ boxShadow: `inset 0 3px 0 0 ${project.color}` }}
        >
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              {renaming ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitName();
                    if (e.key === "Escape") {
                      setName(project.name);
                      setRenaming(false);
                    }
                  }}
                  aria-label="Project name"
                  className="w-full border-b border-accent bg-transparent pb-1 text-lg font-semibold outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  title="Rename"
                  className="block max-w-full truncate text-start text-lg font-semibold hover:text-accent-soft"
                >
                  {project.name}
                </button>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint tabular-nums">
                <span>
                  {done.length} of {tasks.length} done
                </span>
                <span aria-hidden="true">·</span>
                <span>{open.length} open</span>
                <span aria-hidden="true">·</span>
                {/*
                  The team slot, with one person in it. Shipping the row now
                  means adding a second face later is data, not layout.
                */}
                <span className="flex items-center gap-1.5">
                  <Avatar
                    emoji={state.profile.avatarEmoji}
                    size={20}
                    ring={project.color}
                    title={state.profile.displayName}
                  />
                  {state.profile.displayName}
                </span>
              </p>
            </div>

            <Ring pct={pct} size={48} stroke={4} color={project.color}>
              <span className="text-[10px] font-medium tabular-nums">{Math.round(pct * 100)}%</span>
            </Ring>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-dim transition-colors hover:text-ink"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-faint">Project colour</span>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateProject(project.id, { color: c })}
                aria-label={`Set colour ${c}`}
                className={`size-5 rounded-full transition-transform ${
                  project.color === c ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""
                }`}
                style={{ background: c }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                updateProject(project.id, { status: "archived" });
                onClose();
              }}
              className="ms-auto rounded-lg px-2 py-1 text-[11px] text-ink-faint transition-colors hover:text-p-high"
            >
              Archive
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          {/* Second on a phone, where adding is what you opened this for and
              the outline is what you scroll to. In the two-column layout the
              order is left-to-right again and the outline leads. */}
          <section className="order-2 min-w-0 lg:order-none">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
              Outline
            </h3>

            {roots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink-faint">
                No tasks yet. Add the first one, then break it down.
              </p>
            ) : (
              <ul className="flex flex-col">
                {roots.map((t) => (
                  <Node
                    key={t.id}
                    task={t}
                    depth={0}
                    children_={children}
                    project={project}
                    owner={state.profile.avatarEmoji}
                    ownerName={state.profile.displayName}
                    addingUnder={addingUnder}
                    setAddingUnder={setAddingUnder}
                    onAddSub={addSub}
                    onToggle={(x) => (x.status === "done" ? reopenTask(x.id) : completeTask(x.id))}
                    onEdit={setEditingTask}
                    onRecolour={(id, key) => updateTask(id, { colorKey: key })}
                    onDelete={deleteTask}
                  />
                ))}
              </ul>
            )}
          </section>

          <form
            onSubmit={add}
            className="order-1 rounded-xl border border-line bg-surface p-4 lg:order-none lg:sticky lg:top-0"
          >
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
              New task
            </p>

            {/* The field and its disclosure share one underline, so the arrow
                reads as part of the field rather than a button beside it. */}
            <div className="flex items-center gap-2 border-b border-line pb-2 focus-within:border-accent">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a task to this project…"
                aria-label="New task title"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => setOptions((v) => !v)}
                aria-expanded={options}
                aria-controls="new-task-options"
                aria-label={options ? "Hide task options" : "Show task options"}
                className="grid size-6 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
              >
                <svg
                  viewBox="0 0 16 16"
                  className={`size-4 transition-transform ${options ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path
                    d="m4 6 4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* What the collapsed form is currently set to. Without it the
                options are not just hidden, they are unknowable. */}
            {!options && (
              <p className="mt-2 text-[11px] text-ink-faint lg:hidden">
                {relativeLabel(dueDate)}
                {dueTime ? ` · ${dueTime}` : ""}
                {recurrence ? " · repeats" : ` · ${priority}`}
              </p>
            )}

            <div id="new-task-options" className={options ? "" : "hidden lg:block"}>
              <div className="mt-3 flex gap-2">
                <DatePicker value={dueDate} onChange={setDueDate} />
                <TimePicker value={dueTime} onChange={setDueTime} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {RECURRENCES.map(([label, r]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setRecurrence(r)}
                    className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                      sameRecurrence(recurrence, r)
                        ? "bg-accent text-on-accent"
                        : "bg-surface-2 text-ink-dim hover:text-ink"
                    }`}
                  >
                    {label === "Never" ? "Once" : label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <ColorPicker value={colorKey} onChange={setColorKey} />
              </div>

              {recurrence ? (
                <p className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-[10px] leading-relaxed text-accent-soft">
                  Repeats pay the Medium rate. Each scheduled day appears automatically.
                </p>
              ) : (
                <div className="mt-4 flex items-center gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 rounded-lg py-1.5 text-[11px] capitalize transition-colors ${
                        priority === p
                          ? "bg-accent text-on-accent"
                          : "bg-surface-2 text-ink-dim hover:text-ink"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!title.trim()}
              className="mt-4 w-full rounded-lg bg-accent py-2 text-xs font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Add task
            </button>
          </form>
        </div>
      </div>
      <AddTaskSheet
        open={editingTask !== null}
        onClose={() => setEditingTask(null)}
        onSubmit={(input) => {
          if (editingTask) updateTask(editingTask.id, input);
        }}
        defaultProjectId={project.id}
        task={editingTask ?? undefined}
      />
    </div>
  );
}

/* --------------------------------- outline -------------------------------- */

interface NodeProps {
  task: Task;
  depth: number;
  /** Trailing underscore: `children` is taken by React's own prop. */
  children_: Map<string, Task[]>;
  project: Project;
  owner: string;
  ownerName: string;
  addingUnder: string | null;
  setAddingUnder: (id: string | null) => void;
  onAddSub: (parent: Task, title: string) => void;
  onToggle: (t: Task) => void;
  onEdit: (task: Task) => void;
  onRecolour: (id: string, key: string | undefined) => void;
  onDelete: (id: string) => void;
}

function Node(props: NodeProps) {
  const { task, depth, children_, project, owner, ownerName, addingUnder, setAddingUnder } = props;
  const [editing, setEditing] = useState(false);
  const [sub, setSub] = useState("");

  const kids = children_.get(task.id) ?? [];
  const kidsDone = kids.filter((k) => k.status === "done").length;
  const category = swatch(task.colorKey);
  const done = task.status === "done";
  const adding = addingUnder === task.id;

  return (
    <li className="relative">
      {/* The stub from the parent's rail into this row. Drawn by the child so
          the list stays a list — a wrapper div would not be valid inside it. */}
      {depth > 0 && (
        <span className="absolute -start-4 top-[1.15rem] w-3 border-t border-line" aria-hidden="true" />
      )}
      <div
        className="group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-2"
        style={category && !done ? { background: tint(category.color, 8) } : undefined}
      >
        {category && (
          <span
            className="absolute inset-y-2 start-0 w-[3px] rounded-full"
            style={{ background: category.color, opacity: done ? 0.35 : 1 }}
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          onClick={() => props.onToggle(task)}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
            done ? "border-accent bg-accent text-on-accent" : "border-line hover:border-ink-dim"
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

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            {task.recurrence && <RepeatGlyph className="size-3 text-accent-soft" />}
            <span className={`min-w-0 truncate text-sm ${done ? "text-ink-faint line-through" : ""}`}>
              {task.title}
            </span>
          </span>
          {/* A parent's own progress, which is what makes the indent worth
              having rather than just being decoration. */}
          {kids.length > 0 && (
            <span className="mt-1 flex items-center gap-2">
              <span className="w-16">
                <Bar pct={kidsDone / kids.length} color="bg-accent-deep" />
              </span>
              <span className="text-[10px] text-ink-faint tabular-nums">
                {kidsDone}/{kids.length}
              </span>
            </span>
          )}
        </span>

        {task.dueDate && (
          <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">
            {relativeLabel(task.dueDate)}
            {task.dueTime ? ` · ${task.dueTime}` : ""}
          </span>
        )}

        {/* Who it belongs to. One face today; the column is what changes when
            a project can have more than one member. */}
        <Avatar emoji={owner} size={22} ring={project.color} title={ownerName} />

        <button
          type="button"
          onClick={() => props.onEdit(task)}
          aria-label={`Edit ${task.title}`}
          className="grid size-5 shrink-0 place-items-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink focus:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path
              d="m3 11.5-.5 2 2-.5 7.6-7.6-1.5-1.5L3 11.5Zm6.5-6.5 1.5 1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {depth < MAX_DEPTH - 1 && (
          <button
            type="button"
            onClick={() => setAddingUnder(adding ? null : task.id)}
            aria-label={`Add a sub-task under ${task.title}`}
            className="grid size-5 shrink-0 place-items-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink focus:opacity-100 group-hover:opacity-100"
          >
            +
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={`Change category for ${task.title}`}
          className="grid size-5 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-colors hover:text-ink"
          style={category ? { background: category.color, borderColor: category.color } : undefined}
        >
          {!category && <span className="text-[9px]">◌</span>}
        </button>

        <button
          type="button"
          onClick={() => props.onDelete(task.id)}
          aria-label={`Delete ${task.title}`}
          className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-p-high focus:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {editing && (
        <div className="animate-pop-in ms-8 mt-1 rounded-xl border border-line bg-surface p-3">
          <ColorPicker
            value={task.colorKey}
            onChange={(key) => {
              props.onRecolour(task.id, key);
              setEditing(false);
            }}
          />
        </div>
      )}

      {(kids.length > 0 || adding) && (
        /*
         * The indent is drawn, not implied: one rail down the left of the
         * group and a stub into each row. Without the lines a nested list at
         * this row height reads as a slightly misaligned flat one.
         */
        <ul className="relative ms-[0.6875rem] border-s border-line ps-4">
          {kids.map((k) => (
            <Node key={k.id} {...props} task={k} depth={depth + 1} />
          ))}

          {adding && (
            <li className="relative py-1">
              <span
                className="absolute -start-4 top-1/2 w-3 border-t border-line"
                aria-hidden="true"
              />
              <form
                className="animate-pop-in"
                onSubmit={(e) => {
                  e.preventDefault();
                  props.onAddSub(task, sub);
                  setSub("");
                  setAddingUnder(null);
                }}
              >
                <input
                  autoFocus
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                  onBlur={() => setAddingUnder(null)}
                  onKeyDown={(e) => e.key === "Escape" && setAddingUnder(null)}
                  placeholder="Sub-task…"
                  aria-label={`Sub-task of ${task.title}`}
                  className="w-full rounded-lg border border-accent/40 bg-surface px-2.5 py-1.5 text-[13px] outline-none placeholder:text-ink-faint"
                />
              </form>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
