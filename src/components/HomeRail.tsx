"use client";

import Link from "next/link";

import { Bar, Card, Ring } from "@/components/ui";
import { LEAGUE_TIER, timeToReset } from "@/lib/demo/league";
import { today } from "@/lib/domain/dates";
import { levelTitle } from "@/lib/domain/level";
import { dailyQuests } from "@/lib/domain/quests";
import { tint } from "@/lib/domain/palette";
import { isStreakAlive, nextMilestone } from "@/lib/domain/streak";
import type { LocalDate, Priority, Task } from "@/lib/domain/types";
import {
  DAILY_TASK_XP_CAP,
  prioritySlotsLeft,
  taskXpEarnedOn,
  xpBetween,
} from "@/lib/domain/xp";
import { useOrvan, useStats } from "@/lib/store/store";

export function HomeRail({ date, label = "Today" }: { date?: LocalDate; label?: string }) {
  const { state } = useOrvan();
  const stats = useStats();
  const day = today();
  const viewDate = date ?? day;

  const pct = stats.isMaxLevel
    ? 1
    : stats.xpForNext === 0
      ? 0
      : stats.xpIntoLevel / stats.xpForNext;

  const alive = isStreakAlive(stats.streak, day);
  const shown = alive ? stats.streak.current : 0;
  const milestone = nextMilestone(shown);
  const quests = dailyQuests(state.xpEvents, day);
  const questsDone = quests.filter((q) => q.progress >= q.target).length;
  const earnedToday = taskXpEarnedOn(state.xpEvents, day);
  const reset = timeToReset();

  // Everything earned today, not just task XP — this is the number that has to
  // visibly move the moment a box is ticked.
  const gainedToday = xpBetween(state.xpEvents, day, day);

  // Docked as a rail on wide screens; below that it drops under the task list,
  // where a single tall column would just be scrolling for its own sake.
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-fit">
          <Ring pct={pct} size={112} stroke={6}>
            <span className="text-center">
              <span className="block text-[11px] uppercase tracking-widest text-ink-faint">
                Level
              </span>
              <span className="-mt-1 block text-3xl font-semibold tabular-nums">{stats.level}</span>
            </span>
          </Ring>
        </div>

        <p className="relative mt-3 text-center text-sm font-medium">{levelTitle(stats.level)}</p>
        <p className="relative mt-0.5 text-center text-xs text-ink-dim tabular-nums">
          {stats.isMaxLevel
            ? `${stats.totalXp} XP · max level`
            : `${stats.xpIntoLevel} / ${stats.xpForNext} XP to level ${stats.level + 1}`}
        </p>
        <p className="relative mt-2 text-center text-[11px] tabular-nums">
          {gainedToday > 0 ? (
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-accent-soft">
              +{gainedToday} XP today
            </span>
          ) : (
            <span className="text-ink-faint">Nothing earned yet today</span>
          )}
        </p>
      </section>

      <DayChart tasks={state.tasks} date={viewDate} label={label} />

      <Card
        title="Daily quests"
        aside={
          <span className="text-[11px] text-ink-dim tabular-nums">
            {questsDone}/{quests.length}
          </span>
        }
      >
        <ul className="flex flex-col gap-2.5">
          {quests.map((q) => {
            const complete = q.progress >= q.target;
            return (
              <li key={q.key} className="flex items-center gap-2.5">
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                    complete ? "border-accent bg-accent text-on-accent" : "border-line text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] ${
                      complete ? "text-ink-faint line-through" : "text-ink-dim"
                    }`}
                  >
                    {q.label}
                  </span>
                  <span className="mt-1.5 block">
                    <Bar pct={q.progress / q.target} color="bg-accent-deep" />
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-accent-soft tabular-nums">+{q.xp}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Streak">
        <div className="flex items-baseline gap-2">
          <span aria-hidden="true" className={alive ? "text-2xl" : "text-2xl grayscale"}>
            🔥
          </span>
          <span className="text-3xl font-semibold tabular-nums">{shown}</span>
          <span className="text-xs text-ink-dim">day{shown === 1 ? "" : "s"}</span>
        </div>
        <p className="mt-2 text-xs text-ink-dim">
          {milestone
            ? `${milestone.days - shown} more to unlock +${milestone.xp} XP`
            : "Every milestone unlocked."}
        </p>
        <p className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-faint">
          <span>Freezes owned</span>
          <span className="tabular-nums">{stats.streak.freezesOwned}</span>
        </p>
      </Card>

      <Card
        title="Today's cap"
        aside={
          <span className="text-[11px] text-ink-dim tabular-nums">
            {earnedToday}/{DAILY_TASK_XP_CAP} XP
          </span>
        }
      >
        <Bar pct={earnedToday / DAILY_TASK_XP_CAP} />

        {/*
          The slot counters are here because a completion that pays 0 XP is the
          single most confusing thing the scoring can do. Showing what is left
          before the click turns it from a dead number into a rule.
        */}
        <ul className="mt-3 flex gap-1.5">
          {(["high", "medium", "low"] as Priority[]).map((p) => {
            const left = prioritySlotsLeft(state.xpEvents, day, p);
            const out = left <= 0;
            return (
              <li
                key={p}
                className={`flex-1 rounded-lg px-2 py-1.5 text-center text-[10px] ${
                  out ? "bg-surface-2 text-ink-faint" : "bg-surface-2 text-ink-dim"
                }`}
              >
                <span className="block capitalize">{p}</span>
                <span className={`block tabular-nums ${out ? "text-p-high" : "text-accent-soft"}`}>
                  {left === Number.POSITIVE_INFINITY ? "∞" : `${left} left`}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
          Tasks you write yourself cap at {DAILY_TASK_XP_CAP} XP a day. Quests and streak bonuses
          are on top.
        </p>
      </Card>

      <Link
        href="/leaderboard"
        className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/40"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">
            League
          </span>
          <span className="text-[11px] text-ink-faint tabular-nums">
            ends in {reset.days}d {reset.hours}h
          </span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm font-medium">
          <span aria-hidden="true" className="text-coin">
            ◆
          </span>
          {LEAGUE_TIER} League
        </p>
        <p className="mt-0.5 text-xs text-ink-dim">Top 5 promote · bottom 5 demote</p>
      </Link>
    </div>
  );
}

/* ------------------------------- day chart -------------------------------- */

/** Tallest a bar gets, so the card keeps the same height as the ring beside it. */
const BAR_AREA = 56;

const PRIORITY_BARS: ReadonlyArray<readonly [Priority, string, string]> = [
  ["high", "High", "var(--color-p-high)"],
  ["medium", "Med", "var(--color-p-med)"],
  ["low", "Low", "var(--color-p-low)"],
];

/**
 * What the selected day actually looks like: how much is on it, and how much
 * of that is finished.
 *
 * It follows the day tabs rather than being pinned to today — the list below
 * already changes when you step to tomorrow, and a summary that kept showing
 * today's numbers beside it would be read as the same day's.
 */
function DayChart({ tasks, date, label }: { tasks: Task[]; date: LocalDate; label: string }) {
  // Same rule the list uses: a task with no date belongs to the day you are on.
  const mine = tasks.filter((t) => (t.dueDate ?? date) === date);
  const done = mine.filter((t) => t.status === "done").length;
  const pct = mine.length === 0 ? 0 : done / mine.length;

  const bars = PRIORITY_BARS.map(([p, name, color]) => {
    const of = mine.filter((t) => t.priority === p);
    return { name, color, total: of.length, done: of.filter((t) => t.status === "done").length };
  });
  // Scale to the busiest bucket, not to the total: three bars scaled to 12
  // when the day holds 4 tasks would all be slivers.
  const peak = Math.max(1, ...bars.map((b) => b.total));

  return (
    <Card
      title={label}
      aside={
        <span className="text-[11px] text-ink-dim tabular-nums">
          {done}/{mine.length} done
        </span>
      }
    >
      {mine.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-faint">Nothing scheduled.</p>
      ) : (
        <div className="flex items-center gap-4">
          <Ring pct={pct} size={84} stroke={7}>
            <span className="text-center">
              <span className="block text-lg font-semibold leading-none tabular-nums">
                {Math.round(pct * 100)}%
              </span>
              <span className="mt-0.5 block text-[10px] text-ink-faint">done</span>
            </span>
          </Ring>

          {/* Pixel heights rather than percentages: a percentage inside a flex
              column with no definite height resolves to nothing. */}
          <div className="flex min-w-0 flex-1 items-end gap-2.5">
            {bars.map((b, i) => {
              const h = Math.max(4, (b.total / peak) * BAR_AREA);
              return (
                <div key={b.name} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] text-ink-faint tabular-nums">
                    {b.total === 0 ? "·" : `${b.done}/${b.total}`}
                  </span>
                  {/*
                    The track is the whole bucket; the fill is what is done.
                    Tinted in the bar's own colour rather than neutral grey, so
                    an untouched bucket still reads as *that* priority instead
                    of as a grey block competing with the one beside it.
                  */}
                  <div
                    className="animate-grow-y relative w-full rounded-md"
                    style={{
                      height: h,
                      background: tint(b.color, 14),
                      animationDelay: `${i * 70}ms`,
                    }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-md transition-[height] duration-500"
                      style={{
                        height: b.total === 0 ? 0 : (b.done / b.total) * h,
                        background: b.color,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-ink-faint">{b.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
