"use client";

import Link from "next/link";

import { NavIcon } from "@/components/NavIcon";
import { today } from "@/lib/domain/dates";
import { levelTitle } from "@/lib/domain/level";
import { isStreakAlive } from "@/lib/domain/streak";
import { useOrvan, useStats } from "@/lib/store/store";
import { ThemeToggle } from "@/lib/theme";

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /**
   * Set when the action is a control group rather than a single button. On a
   * phone it then takes its own line — sharing the row with the title and the
   * header icons left Calendar's view switcher squeezing the title to three
   * characters.
   */
  wideAction?: boolean;
}

export function TopBar({ title, subtitle, action, wideAction = false }: Props) {
  const { state } = useOrvan();
  const stats = useStats();

  const pct = stats.isMaxLevel
    ? 1
    : stats.xpForNext === 0
      ? 0
      : stats.xpIntoLevel / stats.xpForNext;

  const alive = isStreakAlive(stats.streak, today());

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-[17px]">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-[11px] text-ink-dim sm:text-xs">{subtitle}</p>
          )}
        </div>

        {action &&
          (wideAction ? (
            <div className="order-last w-full sm:order-none sm:w-auto">{action}</div>
          ) : (
            action
          ))}

        {/* The streak and coin counters are context, not controls — on a narrow
            window the page title and the action button matter more. */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <Chip
            title={`${stats.streak.current}-day streak`}
            tone={alive ? "text-flame" : "text-ink-faint"}
            icon="🔥"
            value={alive ? stats.streak.current : 0}
          />
          <Chip
            title={`${stats.coins} coins`}
            tone="text-coin"
            icon="◎"
            value={stats.coins}
          />
        </div>

        {/* The two routes the bottom bar has no room for. On `md` and up they
            are in the rail, so these are mobile-only. */}
        <Link
          href="/leaderboard"
          aria-label="Leaderboard"
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-dim transition-colors hover:border-accent/40 hover:text-ink md:hidden"
        >
          <NavIcon href="/leaderboard" className="size-[18px]" />
        </Link>

        <ThemeToggle className="size-9 shrink-0 rounded-xl md:hidden" />

        <Link
          href="/profile"
          className="relative shrink-0"
          title={`Level ${stats.level} · ${levelTitle(stats.level)}`}
          aria-label={`Profile — level ${stats.level}, ${levelTitle(stats.level)}`}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
            <circle
              cx="20"
              cy="20"
              r={RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - pct)}
              transform="rotate(-90 20 20)"
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-sm">
            {state.profile.avatarEmoji}
          </span>
        </Link>
      </div>
    </header>
  );
}

function Chip({
  title,
  tone,
  icon,
  value,
}: {
  title: string;
  tone: string;
  icon: string;
  value: number;
}) {
  return (
    <span
      title={title}
      className={`flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] ${tone}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  );
}
