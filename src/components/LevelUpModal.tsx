"use client";

import { levelTitle } from "@/lib/domain/level";

interface Props {
  level: number | null;
  onClose: () => void;
}

export function LevelUpModal({ level, onClose }: Props) {
  if (level === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-shade/70 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${level} reached`}
    >
      <div className="animate-pop-in w-full max-w-xs rounded-2xl border border-accent/30 bg-surface p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-accent">Level up</p>
        <p className="mt-3 text-5xl font-medium">{level}</p>
        <p className="mt-1 text-sm text-ink-dim">{levelTitle(level)}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-on-accent"
        >
          Keep going
        </button>
      </div>
    </div>
  );
}
