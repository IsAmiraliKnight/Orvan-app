"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TopBar } from "@/components/TopBar";
import { Pill } from "@/components/ui";
import {
  DEMOTION_SLOTS,
  LEAGUE_TIER,
  PROMOTION_SLOTS,
  ROOM_SIZE,
  standings,
  timeToReset,
  type Standing,
} from "@/lib/demo/league";
import { startOfWeek, today } from "@/lib/domain/dates";
import { xpBetween } from "@/lib/domain/xp";
import { useOrvan } from "@/lib/store/store";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { state, ready } = useOrvan();

  const rows = useMemo(() => {
    const day = today();
    return standings({
      name: state.profile.displayName,
      avatar: state.profile.avatarEmoji,
      weeklyXp: xpBetween(state.xpEvents, startOfWeek(day), day),
    });
  }, [state.profile.displayName, state.profile.avatarEmoji, state.xpEvents]);

  const reset = timeToReset();
  const you = rows.find((r) => r.isYou);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  /**
   * The pinned row is a stand-in for your real row while it is scrolled out of
   * sight. Showing both at once would read as a duplicate, not as a pin.
   */
  const inlineRow = useRef<HTMLLIElement>(null);
  const [inlineVisible, setInlineVisible] = useState(false);

  useEffect(() => {
    const el = inlineRow.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting), {
      rootMargin: "-64px 0px -88px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, you?.id]);

  if (!ready) return <div className="flex-1 animate-pulse bg-bg" aria-label="Loading" />;

  return (
    <>
      <TopBar
        title="Leaderboard"
        subtitle={`${LEAGUE_TIER} League · resets in ${reset.days}d ${reset.hours}h`}
      />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-coin" aria-hidden="true">
              ◆
            </span>
            {LEAGUE_TIER} League
            <span className="text-ink-faint">· room of {ROOM_SIZE}</span>
          </p>
          <div className="flex items-center gap-2">
            <Pill tone="text-accent-soft">Top {PROMOTION_SLOTS} promote</Pill>
            <Pill tone="text-p-high">Bottom {DEMOTION_SLOTS} demote</Pill>
          </div>
        </div>

        <Podium members={podium} />

        <ul className="mt-6 flex flex-col gap-1.5">
          {rest.map((m) => (
            <li key={m.id} ref={m.isYou ? inlineRow : undefined}>
              {m.rank === PROMOTION_SLOTS + 1 && <Divider label="Promotion" tone="accent" />}
              {m.rank === ROOM_SIZE - DEMOTION_SLOTS + 1 && (
                <Divider label="Demotion" tone="danger" />
              )}
              <Row member={m} />
            </li>
          ))}
        </ul>
      </div>

      {you && you.rank > 3 && !inlineVisible && (
        <div className="animate-pop-in sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-5 pt-10 sm:px-6 md:bottom-0">
          <div className="mx-auto max-w-3xl">
            <Row member={you} sticky />
          </div>
        </div>
      )}
    </>
  );
}

function Podium({ members }: { members: Standing[] }) {
  // Rendered 2nd · 1st · 3rd so the winner sits in the middle.
  const order = [members[1], members[0], members[2]].filter(Boolean);
  const height: Record<number, string> = {
    1: "h-32 sm:h-40",
    2: "h-24 sm:h-28",
    3: "h-20 sm:h-24",
  };

  return (
    <section
      aria-label="Top three"
      className="relative overflow-hidden rounded-2xl border border-line bg-surface px-4 pt-8"
    >
      <div
        className="pointer-events-none absolute -top-28 left-1/2 size-72 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative grid grid-cols-3 items-end gap-2 sm:gap-4">
        {order.map((m) => (
          <div key={m.id} className="flex min-w-0 flex-col items-center">
            <div className="relative">
              <span
                className={`grid size-14 place-items-center rounded-full border-2 bg-surface-2 text-2xl sm:size-16 ${
                  m.rank === 1 ? "border-accent" : "border-line"
                }`}
              >
                {m.avatar}
              </span>
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg"
                aria-hidden="true"
              >
                {MEDAL[m.rank - 1]}
              </span>
            </div>

            <p className="mt-3 w-full truncate text-center text-[13px] font-medium">
              {m.isYou ? "You" : m.name}
            </p>
            <p className="mt-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-accent-soft tabular-nums">
              {m.weeklyXp} XP
            </p>

            <div
              className={`mt-3 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-line bg-surface-2 pt-3 ${height[m.rank]}`}
            >
              <span className="text-3xl font-semibold text-ink-faint/50 tabular-nums sm:text-4xl">
                {m.rank}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="relative -mx-4 h-1 bg-accent" aria-hidden="true" />
    </section>
  );
}

function Row({ member, sticky = false }: { member: Standing; sticky?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        member.isYou
          ? "border-accent/40 bg-accent/10"
          : "border-line bg-surface hover:border-ink-faint/30"
      } ${sticky ? "shadow-xl shadow-shade/30" : ""}`}
    >
      <span className="w-6 shrink-0 text-center text-xs text-ink-faint tabular-nums">
        {member.rank}
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-base">
        {member.avatar}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {member.isYou ? "You" : member.name}
        </span>
        <span className="block truncate text-[11px] text-ink-faint">{member.handle}</span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs tabular-nums ${
          member.isYou ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-dim"
        }`}
      >
        {member.weeklyXp} XP
      </span>
    </div>
  );
}

function Divider({ label, tone }: { label: string; tone: "accent" | "danger" }) {
  const color = tone === "accent" ? "text-accent-soft" : "text-p-high";
  const line = tone === "accent" ? "bg-accent/30" : "bg-p-high/30";
  return (
    <div className="flex items-center gap-3 px-1 py-2.5">
      <span className={`h-px flex-1 ${line}`} aria-hidden="true" />
      <span className={`text-[10px] font-medium uppercase tracking-widest ${color}`}>{label}</span>
      <span className={`h-px flex-1 ${line}`} aria-hidden="true" />
    </div>
  );
}
