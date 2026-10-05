"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/NavIcon";
import { levelTitle } from "@/lib/domain/level";
import { isActivePath } from "@/lib/nav";
import { useOrvan, useStats } from "@/lib/store/store";
import { ThemeToggle } from "@/lib/theme";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

interface NavItem {
  href: string;
  label: string;
  /** Items are rendered in groups, separated by a hairline. */
  group: number;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", group: 1 },
  { href: "/calendar", label: "Calendar", group: 1 },
  { href: "/projects", label: "Projects", group: 1 },
  { href: "/finance", label: "Finance", group: 1 },
  { href: "/growth", label: "Growth", group: 2 },
  { href: "/leaderboard", label: "Leaderboard", group: 2 },
  { href: "/profile", label: "Profile", group: 3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { state } = useOrvan();
  const stats = useStats();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center py-5 md:flex lg:w-[84px]">
      <Link href="/" className="grid size-10 place-items-center" aria-label="Orvan home">
        <svg viewBox="0 0 32 32" className="size-8 text-accent" aria-hidden="true">
          <circle cx="16" cy="8" r="4.4" fill="currentColor" />
          <circle cx="8.5" cy="21" r="4.4" fill="currentColor" opacity="0.72" />
          <circle cx="23.5" cy="21" r="4.4" fill="currentColor" opacity="0.45" />
        </svg>
      </Link>

      <nav className="mt-6 flex flex-col items-center gap-1 rounded-[26px] border border-line bg-surface p-2">
        {NAV.map((item, i) => {
          const active = isActivePath(pathname, item.href);
          const newGroup = i > 0 && NAV[i - 1].group !== item.group;
          return (
            <div key={item.href} className="contents">
              {newGroup && <span className="my-1.5 h-px w-6 bg-line" aria-hidden="true" />}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative grid size-11 place-items-center rounded-2xl transition-colors ${
                  active
                    ? "bg-accent text-on-accent"
                    : "text-ink-dim hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <NavIcon href={item.href} solid={active} />
                <span className="pointer-events-none absolute start-full top-1/2 z-50 ms-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink shadow-lg shadow-shade/25 group-hover:block">
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3">
        <ThemeToggle className="size-11" />

        <Link
          href="/profile"
          title="Upgrade to Pro"
          className="grid size-11 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-soft transition-colors hover:bg-accent/20"
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <path d="M3 14 4.8 6.5 8 10l2-4.5 2 4.5 3.2-3.5L17 14Z" {...stroke} />
          </svg>
        </Link>

        <Link
          href="/profile"
          title={`${state.profile.displayName} · Lv ${stats.level} ${levelTitle(stats.level)}`}
          className="grid size-11 place-items-center rounded-full border border-line bg-surface text-lg transition-colors hover:border-accent/40"
        >
          {state.profile.avatarEmoji}
        </Link>
      </div>
    </aside>
  );
}
