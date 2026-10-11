"use client";

import Link from "next/link";
import { Bar, Card } from "@/components/ui";
import { toLocalDate } from "@/lib/domain/dates";
import { levelTitle } from "@/lib/domain/level";
import { dailyQuests } from "@/lib/domain/quests";
import { isStreakAlive } from "@/lib/domain/streak";
import type { LocalDate, Priority } from "@/lib/domain/types";
import { DAILY_TASK_XP_CAP, prioritySlotsLeft, taskXpEarnedOn, xpBetween } from "@/lib/domain/xp";
import { useOrvan, useStats } from "@/lib/store/store";

export function HomeRail({ date, label = "Today" }: { date?: LocalDate; label?: string }) {
  const { state, now } = useOrvan();
  const stats = useStats();
  const day = toLocalDate(now);
  const viewDate = date ?? day;
  const tasks = state.tasks.filter((t) => t.dueDate === viewDate);
  const done = tasks.filter((t) => t.status === "done").length;
  const quests = dailyQuests(state.xpEvents, day);
  const questsDone = quests.filter((q) => q.progress >= q.target).length;
  const gained = xpBetween(state.xpEvents, day, day);
  const earned = taskXpEarnedOn(state.xpEvents, day);
  const streak = isStreakAlive(stats.streak, day) ? stats.streak.current : 0;
  const levelPct = stats.isMaxLevel ? 1 : stats.xpIntoLevel / (stats.xpForNext || 1);

  return (
    <aside className="flex flex-col gap-4" aria-label="Progress overview">
      <Card title={`${label} progress`} aside={<span className="text-xs text-ink-dim">{done}/{tasks.length}</span>}>
        <Bar pct={tasks.length ? done / tasks.length : 0} />
        <p className="mt-3 text-xs text-ink-dim">
          {tasks.length === 0 ? "Nothing scheduled for this day." : done === tasks.length ? "All scheduled tasks complete." : `${tasks.length - done} scheduled tasks left.`}
        </p>
      </Card>

      <Card title={`Level ${stats.level}`} aside={<Link href="/growth" className="text-[11px] text-accent-soft hover:underline">View growth →</Link>}>
        <p className="mb-3 text-sm font-medium">{levelTitle(stats.level)}</p>
        <Bar pct={levelPct} />
        <p className="mt-2 text-[11px] text-ink-faint tabular-nums">
          {stats.isMaxLevel ? `${stats.totalXp} XP · max level` : `${stats.xpIntoLevel} / ${stats.xpForNext} XP to level ${stats.level + 1}`}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
          <span className="text-accent-soft">+{gained} XP today</span>
          <span className="text-ink-dim">🔥 {streak} day{streak === 1 ? "" : "s"}</span>
        </div>
        <details className="mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer text-[11px] text-ink-faint">Today&apos;s XP limits · {earned}/{DAILY_TASK_XP_CAP}</summary>
          <ul className="mt-3 flex gap-2">
            {(["high", "medium", "low"] as Priority[]).map((p) => {
              const left = prioritySlotsLeft(state.xpEvents, day, p);
              return <li key={p} className="flex-1 rounded-lg bg-surface-2 p-2 text-center text-[10px] text-ink-dim">
                <span className="block capitalize">{p}</span>
                <span className={left <= 0 ? "text-p-high" : "text-accent-soft"}>{left === Infinity ? "Unlimited" : `${left} left`}</span>
              </li>;
            })}
          </ul>
          <p className="mt-2 text-[11px] text-ink-faint">Quests and streak bonuses are earned on top of the daily task cap.</p>
        </details>
      </Card>

      <details className="rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer text-xs font-medium text-ink-dim">Daily quests <span className="ms-2 text-ink-faint">{questsDone}/{quests.length}</span></summary>
        <ul className="mt-4 flex flex-col gap-3">
          {quests.map((q) => <li key={q.key} className="flex items-center gap-2.5 text-xs">
            <span className={q.progress >= q.target ? "text-accent-soft" : "text-ink-faint"}>{q.progress >= q.target ? "✓" : "○"}</span>
            <span className="min-w-0 flex-1 text-ink-dim">{q.label}<span className="mt-1.5 block"><Bar pct={q.progress / q.target} /></span></span>
            <span className="text-accent-soft">+{q.xp}</span>
          </li>)}
        </ul>
      </details>
    </aside>
  );
}
