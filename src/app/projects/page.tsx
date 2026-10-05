"use client";

import { useMemo, useState } from "react";

import { ProjectDetail } from "@/components/ProjectDetail";
import { TopBar } from "@/components/TopBar";
import { Ring } from "@/components/ui";
import { swatch } from "@/lib/domain/palette";
import type { Project, Task } from "@/lib/domain/types";
import { useOrvan } from "@/lib/store/store";

const FREE_PROJECT_LIMIT = 2;

const SWATCHES = [
  "#2ea98c",
  "#57d7b5",
  "#ffc53d",
  "#ff7a45",
  "#7c9cff",
  "#c98cff",
];

export default function ProjectsPage() {
  const { state, ready, addProject } = useOrvan();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [openId, setOpenId] = useState<string | null>(null);

  const active = useMemo(
    () => state.projects.filter((p) => p.status === "active"),
    [state.projects],
  );

  // Read from state rather than held in state, so a rename or recolour inside
  // the drawer is reflected by the drawer itself.
  const opened = active.find((p) => p.id === openId) ?? null;
  const atLimit = active.length >= FREE_PROJECT_LIMIT;

  function create() {
    if (!name.trim() || atLimit) return;
    addProject(name, color);
    setName("");
    setColor(SWATCHES[0]);
    setCreating(false);
  }

  if (!ready) return <div className="flex-1 animate-pulse bg-bg" aria-label="Loading" />;

  return (
    <>
      <TopBar
        title="Projects"
        subtitle={`${active.length} of ${FREE_PROJECT_LIMIT} active on Free`}
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={atLimit}
            className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            + New project
          </button>
        }
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {active.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              tasks={state.tasks}
              onOpen={() => setOpenId(p.id)}
            />
          ))}

          {creating && !atLimit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
              className="animate-pop-in rounded-2xl border border-accent/40 bg-surface p-5"
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                placeholder="Project name"
                aria-label="Project name"
                className="w-full border-b border-line bg-transparent pb-2 text-sm outline-none placeholder:text-ink-faint focus:border-accent"
              />
              <div className="mt-4 flex gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Colour ${c}`}
                    className={`size-6 rounded-full transition-transform ${
                      color === c ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg px-3 py-2 text-xs text-ink-dim hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-on-accent disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {!creating && !atLimit && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-line text-sm text-ink-faint transition-colors hover:border-accent/50 hover:text-accent-soft"
            >
              <span>
                <span className="block text-2xl" aria-hidden="true">
                  +
                </span>
                <span className="mt-1 block">New project</span>
              </span>
            </button>
          )}

          {/* Shown, not hidden: seeing the lock is what sells the upgrade. */}
          {atLimit && <LockedCard />}
        </div>
      </div>

      {opened && <ProjectDetail project={opened} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ProjectCard({
  project,
  tasks,
  onOpen,
}: {
  project: Project;
  tasks: Task[];
  onOpen: () => void;
}) {
  const mine = tasks.filter((t) => t.projectId === project.id);
  const done = mine.filter((t) => t.status === "done").length;
  const pct = mine.length === 0 ? 0 : done / mine.length;
  const open = mine.filter((t) => t.status === "open").slice(0, 3);

  // The whole card is the target. A separate "open" affordance would be a
  // second thing to find on a surface that only does one thing.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 text-start transition-colors hover:border-accent/40"
    >
      <span
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: project.color }}
        aria-hidden="true"
      />

      <span className="flex w-full items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold">{project.name}</span>
          <span className="mt-1 block text-xs text-ink-faint tabular-nums">
            {done}/{mine.length} tasks
          </span>
        </span>
        <Ring pct={pct} size={56} stroke={5} color={project.color}>
          <span className="text-[11px] font-medium tabular-nums">{Math.round(pct * 100)}%</span>
        </Ring>
      </span>

      <span className="mt-5 flex w-full flex-1 flex-col gap-2">
        {open.length === 0 ? (
          <span className="text-xs text-ink-faint">Nothing open — add a task inside.</span>
        ) : (
          open.map((t) => {
            const category = swatch(t.colorKey);
            return (
              <span key={t.id} className="flex items-center gap-2 text-xs text-ink-dim">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: category?.color ?? project.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{t.title}</span>
              </span>
            );
          })
        )}
      </span>

      <span className="mt-5 flex w-full items-center justify-between border-t border-line pt-3 text-[11px] text-ink-faint">
        <span>{mine.length - done} open</span>
        <span className="text-ink-faint transition-colors group-hover:text-accent-soft">
          Open →
        </span>
      </span>
    </button>
  );
}

function LockedCard() {
  return (
    <section className="relative flex min-h-52 flex-col justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface/50 p-5 text-center">
      <div
        className="pointer-events-none absolute -bottom-16 left-1/2 size-48 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />
      <span className="relative mx-auto grid size-10 place-items-center rounded-full border border-line bg-surface-2">
        <svg viewBox="0 0 20 20" className="size-4 text-ink-faint" aria-hidden="true">
          <rect
            x="4.5"
            y="9"
            width="11"
            height="7.5"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M7.5 9V6.75a2.5 2.5 0 0 1 5 0V9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </span>
      <p className="relative mt-3 text-sm font-medium">Third project</p>
      <p className="relative mt-1 text-xs leading-relaxed text-ink-dim">
        Free keeps {FREE_PROJECT_LIMIT} projects active. Archive one, or go Pro for unlimited.
      </p>
      <button
        type="button"
        className="relative mx-auto mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent-soft transition-colors hover:bg-accent/20"
      >
        Upgrade to Pro
      </button>
    </section>
  );
}
