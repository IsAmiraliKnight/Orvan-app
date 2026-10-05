/**
 * Small presentational primitives shared by the dashboard pages. Keeping them
 * here is what stops every page from re-inventing a card and drifting apart.
 */

export function Card({
  title,
  aside,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface ${padded ? "p-5" : ""} ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Progress ring. `size` is the outer box; the stroke scales with it. */
export function Ring({
  pct,
  size = 112,
  stroke = 6,
  color = "var(--color-accent)",
  track = "var(--color-surface-3)",
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));

  return (
    <div className="relative w-fit" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

/**
 * Segmented progress, as in the habit rows of the reference: discrete ticks
 * rather than a continuous bar, so "6 of 10" is countable at a glance.
 */
export function Segments({
  done,
  total,
  color = "bg-accent",
}: {
  done: number;
  total: number;
  color?: string;
}) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3.5 w-[3px] rounded-full ${i < done ? color : "bg-surface-3"}`}
        />
      ))}
    </span>
  );
}

export function Bar({ pct, color = "bg-accent" }: { pct: number; color?: string }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3">
      <span
        className={`block h-full rounded-full transition-[width] duration-700 ${color}`}
        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }}
      />
    </span>
  );
}

/** The two-arrow loop that marks a repeating task wherever it is listed. */
export function RepeatGlyph({ className = "size-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden="true">
      <path
        d="M4 8.5a4.5 4.5 0 0 1 4.5-4.5H14M16 11.5a4.5 4.5 0 0 1-4.5 4.5H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m12 2 2.5 2L12 6M8 14l-2.5 2L8 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A face for a task's owner. There is one person in the app today, so this is
 * a placeholder in the honest sense: the slot is drawn where an assignee will
 * go, and it already reads correctly with a single member in it.
 */
export function Avatar({
  emoji,
  size = 24,
  ring,
  title,
}: {
  emoji: string;
  size?: number;
  /** Usually the project colour, so a task reads as belonging to its board. */
  ring?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="grid shrink-0 place-items-center rounded-full border bg-surface-2"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        borderColor: ring ?? "var(--color-line)",
      }}
    >
      <span aria-hidden="true">{emoji}</span>
    </span>
  );
}

export function Pill({
  children,
  tone = "text-ink-dim",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] ${tone}`}
    >
      {children}
    </span>
  );
}
