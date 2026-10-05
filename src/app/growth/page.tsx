"use client";

import { useMemo } from "react";

import { Goals } from "@/components/Goals";
import { Locked } from "@/components/Locked";
import { TopBar } from "@/components/TopBar";
import { Bar, Card, Ring, Segments } from "@/components/ui";
import { addDays, startOfWeek, today } from "@/lib/domain/dates";
import { CURRENCY, compact, summarise } from "@/lib/domain/finance";
import { levelTitle } from "@/lib/domain/level";
import { STREAK_MILESTONES } from "@/lib/domain/streak";
import type { LocalDate, Project, Task, XpEvent, XpSource } from "@/lib/domain/types";
import { DAILY_TASK_XP_CAP, taskXpEarnedOn, xpBetween } from "@/lib/domain/xp";
import { useOrvan, useStats } from "@/lib/store/store";

const HEATMAP_DAYS = 35;
const HEAT = ["bg-surface-3", "bg-accent/25", "bg-accent/55", "bg-accent"] as const;

const SOURCES: { key: XpSource; label: string; color: string }[] = [
  { key: "task", label: "Tasks", color: "var(--color-chart-1)" },
  { key: "quest", label: "Quests", color: "var(--color-chart-4)" },
  { key: "streak", label: "Streak", color: "var(--color-chart-5)" },
];

export default function GrowthPage() {
  const { state, ready } = useOrvan();
  const stats = useStats();
  const day = today();

  const bySource = useMemo(() => {
    const totals = new Map<XpSource, number>();
    for (const e of state.xpEvents) {
      totals.set(e.source, (totals.get(e.source) ?? 0) + e.amount);
    }
    return SOURCES.map((s) => ({ ...s, value: totals.get(s.key) ?? 0 }));
  }, [state.xpEvents]);

  const heatmap = useMemo(() => buildHeatmap(state.xpEvents, day), [state.xpEvents, day]);
  const workWeek = useMemo(() => buildWorkWeek(state.xpEvents, day), [state.xpEvents, day]);
  const money = useMemo(() => summarise(state.transactions, day), [state.transactions, day]);

  const tasksDone = state.xpEvents.filter((e) => e.source === "task").length;
  const earnedToday = taskXpEarnedOn(state.xpEvents, day);

  const thisWeek = xpBetween(state.xpEvents, startOfWeek(day), day);
  const lastWeekStart = addDays(startOfWeek(day), -7);
  const lastWeek = xpBetween(state.xpEvents, lastWeekStart, addDays(lastWeekStart, 6));
  const weekMax = Math.max(thisWeek, lastWeek, 1);

  const levelPct = stats.isMaxLevel
    ? 1
    : stats.xpForNext === 0
      ? 0
      : stats.xpIntoLevel / stats.xpForNext;

  if (!ready) return <div className="flex-1 animate-pulse bg-bg" aria-label="Loading" />;

  return (
    <>
      <TopBar
        title="Growth"
        subtitle={`Level ${stats.level} · ${levelTitle(stats.level)} · ${stats.totalXp} XP total`}
      />

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Card title="Today's cap">
              <div className="flex items-center gap-5">
                <Ring pct={earnedToday / DAILY_TASK_XP_CAP} size={96} stroke={8}>
                  <span className="text-center">
                    <span className="block text-xl font-semibold tabular-nums">{earnedToday}</span>
                    <span className="block text-[10px] text-ink-faint">
                      of {DAILY_TASK_XP_CAP}
                    </span>
                  </span>
                </Ring>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Task XP today</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
                    Self-written tasks stop paying at {DAILY_TASK_XP_CAP} XP. Quests and streak
                    bonuses sit on top of the cap.
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Level progress">
              <p className="text-2xl font-semibold tabular-nums">
                {stats.xpIntoLevel}
                <span className="text-base font-normal text-ink-faint">
                  {" "}
                  / {stats.isMaxLevel ? "max" : stats.xpForNext} XP
                </span>
              </p>
              <p className="mt-1 text-xs text-ink-dim">
                {stats.isMaxLevel
                  ? "Level cap reached."
                  : `${stats.xpForNext - stats.xpIntoLevel} XP to level ${stats.level + 1}`}
              </p>

              <div className="relative mt-9">
                <span
                  className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-bg"
                  style={{ insetInlineStart: `${Math.min(92, Math.max(8, levelPct * 100))}%` }}
                >
                  Lv {stats.level}
                </span>
                <Bar pct={levelPct} />
                <p className="mt-2 flex justify-between text-[10px] text-ink-faint tabular-nums">
                  <span>Lv {stats.level}</span>
                  <span>Lv {stats.level + 1}</span>
                </p>
              </div>
            </Card>
          </div>

          <Goals />

          {/*
            The dashboard proper. Each panel answers one area of the product, so
            Growth reads as "how am I doing" rather than "here is the XP page
            again in a different shape".
          */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <WorkCard week={workWeek} tasksDone={tasksDone} />
            <ProjectsCard projects={state.projects} tasks={state.tasks} />
            <MoneyCard
              income={money.income}
              spent={money.spent}
              net={money.net}
              entries={state.transactions.length}
            />

            <Locked
              title="Health tracking"
              blurb="Sleep, movement and energy plotted against the days you actually shipped."
            >
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">
                Health
              </p>
              <div className="mt-4 flex h-28 items-end gap-2">
                {[45, 70, 30, 85, 60, 92, 55].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-lg bg-accent/60"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </Locked>
          </div>

          <Card title="Achievements">
            <ul className="flex flex-col">
              {achievements({
                tasksDone,
                longest: stats.streak.longest,
                level: stats.level,
              }).map((a) => {
                const ticks = 12;
                const filled = Math.round(Math.min(1, a.progress / a.target) * ticks);
                return (
                  <li
                    key={a.name}
                    className="flex items-center gap-3 border-b border-line/60 py-3 last:border-0"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-base ${
                        filled === ticks ? "bg-accent/20" : "bg-surface-2 grayscale"
                      }`}
                    >
                      {a.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{a.name}</span>
                      <span className="block truncate text-[11px] text-ink-faint">{a.desc}</span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-ink-faint tabular-nums sm:block">
                      {Math.min(a.progress, a.target)}/{a.target}
                    </span>
                    <Segments done={filled} total={ticks} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Card
            title="Activity"
            aside={<span className="text-[11px] text-ink-faint">last 5 weeks</span>}
            className="bg-surface-2"
          >
            <div className="grid grid-cols-7 gap-1.5">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="pb-1 text-center text-[10px] text-ink-faint">
                  {d}
                </span>
              ))}
              {heatmap.map((cell) => (
                <span
                  key={cell.date}
                  title={`${cell.date} · ${cell.xp} XP`}
                  className={`aspect-square rounded-md ${HEAT[cell.level]} ${
                    cell.isToday ? "ring-1 ring-accent-soft" : ""
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 flex items-center justify-end gap-1.5 text-[10px] text-ink-faint">
              less
              {HEAT.map((c) => (
                <span key={c} className={`size-2.5 rounded-sm ${c}`} />
              ))}
              more
            </p>
          </Card>

          <Card title="This week">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{thisWeek}</span>
              <span className="text-xs text-ink-dim">XP earned</span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {lastWeek === 0
                ? "No data for last week yet."
                : `${thisWeek >= lastWeek ? "▲" : "▼"} ${Math.abs(thisWeek - lastWeek)} XP vs last week`}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <WeekBar label="This week" value={thisWeek} max={weekMax} />
              <WeekBar label="Last week" value={lastWeek} max={weekMax} muted />
            </div>
          </Card>

          <SourceCard sources={bySource} totalXp={stats.totalXp} />

          <Card title="Streak">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl" aria-hidden="true">
                🔥
              </span>
              <span className="text-3xl font-semibold tabular-nums">{stats.streak.current}</span>
              <span className="text-xs text-ink-dim">days</span>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {STREAK_MILESTONES.map(([days, xp]) => {
                const hit = stats.streak.longest >= days;
                return (
                  <li key={days} className="flex items-center gap-2.5 text-xs">
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded-full text-[9px] ${
                        hit ? "bg-accent text-on-accent" : "border border-line text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className={`flex-1 ${hit ? "text-ink-dim" : "text-ink-faint"}`}>
                      {days}-day flame
                    </span>
                    <span className="text-[11px] text-accent-soft tabular-nums">+{xp} XP</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
              <span className="text-ink-faint">Freezes owned</span>
              <span className="tabular-nums">{stats.streak.freezesOwned} / 2</span>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------ dashboards ------------------------------- */

function WorkCard({
  week,
  tasksDone,
}: {
  week: { date: string; label: string; count: number; isToday: boolean }[];
  tasksDone: number;
}) {
  const max = Math.max(...week.map((d) => d.count), 1);
  const total = week.reduce((s, d) => s + d.count, 0);

  return (
    <Card title="Work" aside={<span className="text-[11px] text-ink-faint">7 days</span>}>
      <p className="text-2xl font-semibold tabular-nums">
        {total}
        <span className="ms-1.5 text-xs font-normal text-ink-dim">tasks this week</span>
      </p>

      <div className="mt-4 flex h-24 items-end gap-1.5">
        {week.map((d) => (
          <span key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <span
              className={`w-full rounded-md ${d.isToday ? "bg-accent" : "bg-accent/45"}`}
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
              title={`${d.count} tasks`}
            />
            <span className="text-center text-[10px] text-ink-faint">{d.label}</span>
          </span>
        ))}
      </div>

      <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-faint tabular-nums">
        {tasksDone} completed all time
      </p>
    </Card>
  );
}

function ProjectsCard({ projects, tasks }: { projects: Project[]; tasks: Task[] }) {
  const active = projects.filter((p) => p.status === "active");

  return (
    <Card title="Projects" aside={<span className="text-[11px] text-ink-faint">completion</span>}>
      {active.length === 0 ? (
        <p className="text-xs text-ink-faint">No active projects yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {active.map((p) => {
            const mine = tasks.filter((t) => t.projectId === p.id);
            const done = mine.filter((t) => t.status === "done").length;
            const pct = mine.length === 0 ? 0 : done / mine.length;
            return (
              <li key={p.id} className="flex items-center gap-3">
                <Ring pct={pct} size={44} stroke={4} color={p.color}>
                  <span className="text-[10px] font-medium tabular-nums">
                    {Math.round(pct * 100)}
                  </span>
                </Ring>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="block text-[11px] text-ink-faint tabular-nums">
                    {done}/{mine.length} done · {mine.length - done} open
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function MoneyCard({
  income,
  spent,
  net,
  entries,
}: {
  income: number;
  spent: number;
  net: number;
  entries: number;
}) {
  const max = Math.max(income, spent, 1);

  return (
    <Card title="Money" aside={<span className="text-[11px] text-ink-faint">this month</span>}>
      {entries === 0 ? (
        <p className="py-6 text-center text-xs leading-relaxed text-ink-faint">
          Nothing logged yet.
          <br />
          Add an entry on Finance and this fills in.
        </p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums">
            {compact(net)}
            <span className="ms-1 text-sm font-normal text-ink-dim">{CURRENCY} left</span>
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <WeekBar label="In" value={income} max={max} />
            <WeekBar label="Out" value={spent} max={max} muted />
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-faint tabular-nums">
            {entries} entries logged
          </p>
        </>
      )}
    </Card>
  );
}

/**
 * Where the XP came from, as one bar rather than three floating blobs.
 *
 * The blobs were a whole hero panel spent on three numbers, and their sizes
 * could not be compared to each other — area is the hardest encoding to read,
 * and they overlapped. A single stacked bar says "mostly tasks" at a glance and
 * fits in the rail, which is where a breakdown of a total belongs.
 */
function SourceCard({
  sources,
  totalXp,
}: {
  sources: { key: string; label: string; color: string; value: number }[];
  totalXp: number;
}) {
  const total = Math.max(
    1,
    sources.reduce((sum, s) => sum + s.value, 0),
  );

  return (
    <Card title="XP sources" aside={<span className="text-[11px] text-ink-faint">all time</span>}>
      <p className="text-3xl font-semibold tabular-nums">
        {totalXp}
        <span className="ms-1.5 text-xs font-normal text-ink-dim">XP earned</span>
      </p>

      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {sources.map((s) => (
          <span
            key={s.key}
            className="transition-[flex-grow] duration-500"
            // `flex-grow` rather than a width: a source worth 0 XP then takes
            // no space at all instead of a rounded 1% sliver.
            style={{ flexGrow: s.value, background: s.color }}
            title={`${s.label} · ${s.value} XP`}
          />
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {sources.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="flex-1 text-ink-dim">{s.label}</span>
            <span className="tabular-nums">{s.value}</span>
            <span className="w-9 text-end text-[11px] text-ink-faint tabular-nums">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WeekBar({
  label,
  value,
  max,
  muted = false,
}: {
  label: string;
  value: number;
  max: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] text-ink-faint">{label}</span>
      <span className="min-w-0 flex-1">
        <Bar pct={value / max} color={muted ? "bg-surface-3" : "bg-accent"} />
      </span>
      <span className="w-10 shrink-0 text-end text-[11px] tabular-nums">{compact(value)}</span>
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */

interface HeatCell {
  date: LocalDate;
  xp: number;
  level: number;
  isToday: boolean;
}

/** Monday-aligned so the columns line up with the weekday header. */
function buildHeatmap(events: XpEvent[], day: LocalDate): HeatCell[] {
  const perDay = new Map<LocalDate, number>();
  for (const e of events) perDay.set(e.date, (perDay.get(e.date) ?? 0) + e.amount);

  const end = addDays(startOfWeek(day), 6);
  const start = addDays(end, -(HEATMAP_DAYS - 1));

  return Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const date = addDays(start, i);
    const xp = perDay.get(date) ?? 0;
    return {
      date,
      xp,
      level: xp === 0 ? 0 : xp < 5 ? 1 : xp < 12 ? 2 : 3,
      isToday: date === day,
    };
  });
}

const SHORT_DAY = new Intl.DateTimeFormat("en-US", { weekday: "narrow" });

/**
 * Task completions per day for the trailing week, ending today.
 *
 * `date` is carried alongside the label because the narrow weekday names are
 * not unique — a week contains two Ts and two Ss, which is fine to read and
 * useless as a React key.
 */
function buildWorkWeek(events: XpEvent[], day: LocalDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(day, i - 6);
    return {
      date,
      label: SHORT_DAY.format(new Date(`${date}T00:00:00`)),
      count: events.filter((e) => e.source === "task" && e.date === date).length,
      isToday: date === day,
    };
  });
}

function achievements(input: { tasksDone: number; longest: number; level: number }) {
  return [
    {
      name: "First Blood",
      desc: "Complete your first task",
      icon: "🩸",
      progress: input.tasksDone,
      target: 1,
    },
    {
      name: "7-Day Flame",
      desc: "Keep a streak alive for a week",
      icon: "🔥",
      progress: input.longest,
      target: 7,
    },
    {
      name: "Century",
      desc: "Complete 100 tasks",
      icon: "💯",
      progress: input.tasksDone,
      target: 100,
    },
    { name: "Sapling", desc: "Reach level 10", icon: "🌳", progress: input.level, target: 10 },
  ];
}
