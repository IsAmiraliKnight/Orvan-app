"use client";

import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />

      {/*
        The icon rail is the navigation from `md` up. Below that it moves to a
        floating bar at the bottom of the screen — thumb height — which is why
        there is no second header strip on mobile any more. The padding is what
        stops the last row of a page from sitting under it.
      */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] md:pb-0">
        {children}
      </div>

      <MobileNav />
    </div>
  );
}
