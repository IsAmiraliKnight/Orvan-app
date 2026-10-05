"use client";

/**
 * A Pro panel, shown rather than hidden.
 *
 * The blurred content underneath is real — it is the user's own numbers, out
 * of focus. A grey placeholder would be honest about the paywall but dishonest
 * about what is behind it, and it gives someone no reason to care.
 */
export function Locked({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden="true">
        {children}
      </div>

      <div className="absolute inset-0 grid place-items-center bg-bg/55 p-5 text-center backdrop-blur-[2px]">
        <div>
          <span className="mx-auto grid size-9 place-items-center rounded-full border border-accent/30 bg-accent/10">
            <svg viewBox="0 0 20 20" className="size-4 text-accent-soft" aria-hidden="true">
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
          <p className="mt-2.5 text-sm font-medium">{title}</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-[11px] leading-relaxed text-ink-dim">
            {blurb}
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-[11px] font-medium text-accent-soft transition-colors hover:bg-accent/20"
          >
            Unlock with Pro
          </button>
        </div>
      </div>
    </section>
  );
}
