"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/NavIcon";
import { isActivePath } from "@/lib/nav";

/**
 * Five is the ceiling for a labelled bar at 375px — past that the words start
 * truncating, and a nav label you can't read is worse than an icon alone.
 * Leaderboard and Profile are one-offs rather than daily destinations, so they
 * sit in the header instead.
 */
const ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["/", "Home"],
  ["/calendar", "Calendar"],
  ["/projects", "Projects"],
  ["/finance", "Finance"],
  ["/growth", "Growth"],
];

/**
 * A floating pill bar, in the shape of Telegram's: the whole bar is one rounded
 * slab lifted off the bottom edge, and the selected item is a filled pill
 * inside it rather than an underline or a coloured icon on its own.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.625rem)] md:hidden"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-0.5 rounded-[26px] border border-line bg-surface-float/90 p-1.5 shadow-lg shadow-shade/40 backdrop-blur-xl">
        {ITEMS.map(([href, label]) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-1.5 transition-colors ${
                  active
                    ? "bg-accent/15 text-accent-soft"
                    : "text-ink-dim active:bg-surface-3"
                }`}
              >
                <NavIcon href={href} solid={active} className="size-[22px]" />
                <span
                  className={`text-[10px] leading-none ${
                    active ? "font-semibold" : "font-medium"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
