"use client";

import { TopBar } from "@/components/TopBar";

interface Props {
  title: string;
  blurb: string;
  bullets: string[];
}

export function ComingSoon({ title, blurb, bullets }: Props) {
  return (
    <>
      <TopBar title={title} subtitle="Not designed yet" />
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-dashed border-line p-5 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">
            Next up
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">{blurb}</p>
          <ul className="mt-5 flex flex-col gap-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-ink-dim">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
