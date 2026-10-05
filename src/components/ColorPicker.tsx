"use client";

import { PALETTE, swatch } from "@/lib/domain/palette";

/**
 * The colour category picker. Pro swatches are rendered, not hidden — a greyed
 * row of colours you cannot have is the whole argument for the upgrade, and
 * hiding them would leave the free palette looking like the entire product.
 */
export function ColorPicker({
  value,
  onChange,
  onLocked,
}: {
  value?: string;
  onChange: (key: string | undefined) => void;
  onLocked?: () => void;
}) {
  const active = swatch(value);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          title="No category"
          aria-label="No category"
          className={`grid size-7 place-items-center rounded-full border text-[11px] transition-transform ${
            value === undefined
              ? "scale-110 border-ink-dim text-ink"
              : "border-line text-ink-faint hover:border-ink-faint"
          }`}
        >
          ∅
        </button>

        {PALETTE.map((s) => {
          const selected = value === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => (s.pro ? onLocked?.() : onChange(s.key))}
              title={s.pro ? `${s.name} — Pro` : s.name}
              aria-label={s.pro ? `${s.name}, Pro only` : s.name}
              aria-pressed={selected}
              className={`relative grid size-7 place-items-center rounded-full transition-transform ${
                selected ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
              } ${s.pro ? "opacity-45" : ""}`}
              style={{ background: s.color }}
            >
              {s.pro && (
                <svg viewBox="0 0 20 20" className="size-3 text-on-accent" aria-hidden="true">
                  <rect x="5.5" y="9" width="9" height="6.5" rx="1.6" fill="currentColor" />
                  <path
                    d="M7.8 9V7.2a2.2 2.2 0 0 1 4.4 0V9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-ink-faint">
        {active ? active.name : "No category"}
        <span className="text-ink-faint/70"> · 5 free, more with Pro</span>
      </p>
    </div>
  );
}
