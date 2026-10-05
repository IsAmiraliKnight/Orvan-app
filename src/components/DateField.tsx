"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { addDays, parseLocalDate, today } from "@/lib/domain/dates";
import type { LocalDate } from "@/lib/domain/types";

/**
 * Date and time fields that belong to the app.
 *
 * `<input type="date">` and `<input type="time">` render a browser widget with
 * its own typography, its own accent colour and — on Chrome — a glyph well that
 * has to be inverted by hand per theme. On a screen where everything else is
 * built from the same tokens, they are the one control that looks borrowed.
 */

const WEEKDAY_INITIAL = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const PRETTY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/* -------------------------------------------------------------------------- */

function Trigger({
  onClick,
  open,
  icon,
  children,
  muted = false,
}: {
  onClick: () => void;
  open: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-start text-xs transition-colors ${
        open ? "border-accent bg-surface-2" : "border-line bg-surface-2/60 hover:border-ink-faint/40"
      } ${muted ? "text-ink-faint" : "text-ink"}`}
    >
      <span className="shrink-0 text-ink-faint" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

/** Has to match `w-[17rem]` below — as a number, to keep the panel on screen. */
const POP_W = 272;
const POP_GAP = 6;
/** Never sits flush against the window edge. */
const EDGE = 8;

/**
 * A panel that escapes whatever it was opened from.
 *
 * Absolutely positioned, it was laid out *inside* its container — and the
 * calendar's side panel is a scrolling box. Opening the clock there grew the
 * panel's scroll height and left the dial below the fold, so picking a time
 * meant scrolling to the control you had just opened.
 *
 * Portalled to the body and measured against the trigger instead: it opens
 * where the field is, flips above when the space underneath cannot hold it,
 * and follows the field if anything behind it scrolls.
 */
function Popover({
  anchor,
  onClose,
  children,
}: {
  anchor: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const pop = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  // Layout, not effect: the first paint has to already be in the right place.
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const h = pop.current?.offsetHeight ?? 0;
      if (!a) return;

      const under = window.innerHeight - a.bottom - POP_GAP - EDGE;
      const flip = under < h && a.top - POP_GAP - EDGE > h;

      setAt({
        top: flip
          ? a.top - h - POP_GAP
          : Math.max(EDGE, Math.min(a.bottom + POP_GAP, window.innerHeight - h - EDGE)),
        left: Math.max(EDGE, Math.min(a.left, window.innerWidth - POP_W - EDGE)),
      });
    };

    place();
    window.addEventListener("resize", place);
    // Capture, because the field can sit in any scrolling box, not just the page.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      // The trigger counts as inside, or its own click would reopen what this
      // just closed.
      if (pop.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={pop}
      // Above the add-task sheet, which is z-50 and can contain one of these.
      className="animate-pop-in fixed z-[60] w-[17rem] rounded-2xl border border-line bg-surface p-3 shadow-2xl shadow-shade/40"
      style={{
        top: at?.top ?? 0,
        left: at?.left ?? 0,
        // Hidden for the one frame between mounting and being measured.
        visibility: at ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ---------------------------------- date --------------------------------- */

export function DatePicker({
  value,
  onChange,
  label = "Date",
  markedDates,
}: {
  value: LocalDate;
  onChange: (d: LocalDate) => void;
  label?: string;
  /** Days to flag with a dot — used to show which days already have tasks. */
  markedDates?: Set<LocalDate>;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(value);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Reopening on a different value should land on that value's month.
  useEffect(() => {
    if (open) setCursor(value);
  }, [open, value]);

  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const now = today();

  function pick(d: LocalDate) {
    onChange(d);
    setOpen(false);
  }

  return (
    <div ref={anchor} className="relative min-w-0">
      <Trigger
        open={open}
        onClick={() => setOpen((v) => !v)}
        icon={
          <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        }
      >
        {relativeLabel(value, now)}
      </Trigger>

      {open && (
        <Popover anchor={anchor} onClose={close}>
          <div className="mb-2 flex flex-wrap gap-1">
            {(
              [
                ["Today", now],
                ["Tomorrow", addDays(now, 1)],
                ["Next week", addDays(now, 7)],
              ] as const
            ).map(([text, d]) => (
              <button
                key={text}
                type="button"
                onClick={() => pick(d)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                  value === d
                    ? "bg-accent text-on-accent"
                    : "bg-surface-2 text-ink-dim hover:text-ink"
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium">{MONTH_YEAR.format(parseLocalDate(cursor))}</p>
            <div className="flex gap-1">
              <Step label="Previous month" onClick={() => setCursor(shiftMonth(cursor, -1))}>
                ‹
              </Step>
              <Step label="Next month" onClick={() => setCursor(shiftMonth(cursor, 1))}>
                ›
              </Step>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center" role="grid" aria-label={label}>
            {WEEKDAY_INITIAL.map((w, i) => (
              <span key={i} className="pb-1 text-[10px] text-ink-faint">
                {w}
              </span>
            ))}
            {cells.map(({ date: d, inMonth }) => {
              const selected = d === value;
              const isToday = d === now;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  className={`relative mx-auto grid size-8 place-items-center rounded-full text-xs tabular-nums transition-colors ${
                    selected
                      ? "bg-accent font-semibold text-on-accent"
                      : isToday
                        ? "border border-accent/60 text-accent-soft"
                        : inMonth
                          ? "text-ink-dim hover:bg-surface-2"
                          : "text-ink-faint/45 hover:bg-surface-2"
                  }`}
                >
                  {parseLocalDate(d).getDate()}
                  {markedDates?.has(d) && !selected && (
                    <span className="absolute bottom-1 size-1 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </Popover>
      )}
    </div>
  );
}

/* ---------------------------------- time --------------------------------- */

export function ClockIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6.5V10l2.5 1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * The dial.
 *
 * A task starts with *no* time — a suggested "09:00" is a guess that gets
 * accepted by default and then quietly wrong. So the field opens on a clock
 * face instead: an empty control that costs one gesture to set, rather than a
 * filled one that costs attention to check.
 */
const DIAL = 196;
const CENTRE = DIAL / 2;
/** Morning ring outside, afternoon inside — 24 hours without a meridiem toggle. */
const R_AM = 76;
const R_PM = 50;

function polar(r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CENTRE + r * Math.cos(rad), y: CENTRE + r * Math.sin(rad) };
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Anytime",
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div ref={anchor} className="relative min-w-0">
      <Trigger
        open={open}
        muted={!value}
        onClick={() => setOpen((v) => !v)}
        icon={<ClockIcon />}
      >
        {value || placeholder}
      </Trigger>

      {open && (
        <Popover anchor={anchor} onClose={close}>
          <Dial value={value} onChange={onChange} onDone={close} />
        </Popover>
      )}
    </div>
  );
}

function Dial({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (t: string) => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const parsed = value ? value.split(":").map(Number) : null;
  const hour = parsed ? parsed[0] : null;
  const minute = parsed ? parsed[1] : null;

  function write(h: number, m: number) {
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  /** Reads a pointer as an angle plus which ring it landed on. */
  function apply(e: React.PointerEvent) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    // Normalised through the viewBox, so the maths holds at any rendered size.
    const x = ((e.clientX - box.left) / box.width) * DIAL - CENTRE;
    const y = ((e.clientY - box.top) / box.height) * DIAL - CENTRE;
    const angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    const step = Math.round(((angle + 360) % 360) / 30) % 12;

    if (mode === "minute") {
      write(hour ?? 9, step * 5);
      return;
    }
    // Halfway between the rings, so neither one has to be aimed at precisely.
    const inner = Math.hypot(x, y) < (R_AM + R_PM) / 2;
    write(inner ? step + 12 : step, minute ?? 0);
  }

  const marks =
    mode === "hour"
      ? Array.from({ length: 24 }, (_, i) => ({
          v: i,
          label: String(i).padStart(2, "0"),
          r: i < 12 ? R_AM : R_PM,
          deg: (i % 12) * 30,
          on: hour === i,
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          v: i * 5,
          label: String(i * 5).padStart(2, "0"),
          r: R_AM,
          deg: i * 30,
          on: minute === i * 5,
        }));

  const handR = mode === "minute" ? R_AM : (hour ?? 0) < 12 ? R_AM : R_PM;
  const handDeg = mode === "minute" ? ((minute ?? 0) / 5) * 30 : ((hour ?? 0) % 12) * 30;
  const tip = polar(handR, handDeg);

  return (
    <div>
      {/* The readout doubles as the mode switch — tapping the part you want to
          change is how every clock picker worth copying behaves. */}
      <p className="mb-2 text-center text-2xl font-semibold tabular-nums">
        <Segment on={mode === "hour"} onClick={() => setMode("hour")}>
          {hour === null ? "--" : String(hour).padStart(2, "0")}
        </Segment>
        <span className="mx-0.5 text-ink-faint">:</span>
        <Segment on={mode === "minute"} onClick={() => setMode("minute")}>
          {minute === null ? "--" : String(minute).padStart(2, "0")}
        </Segment>
      </p>

      <svg
        ref={svg}
        viewBox={`0 0 ${DIAL} ${DIAL}`}
        className="mx-auto block w-full max-w-[13rem] touch-none select-none"
        role="slider"
        aria-label={mode === "hour" ? "Hour" : "Minute"}
        aria-valuetext={value || "No time"}
        onPointerDown={(e) => {
          dragging.current = true;
          // Same as the calendar grid: not every pointer id can be captured,
          // and losing the capture only costs the drag past the dial's edge.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* the tap still registers */
          }
          apply(e);
        }}
        onPointerMove={(e) => dragging.current && apply(e)}
        onPointerUp={() => {
          dragging.current = false;
          // Hours then minutes, in one gesture each, without a second control.
          if (mode === "hour") setMode("minute");
        }}
      >
        <circle cx={CENTRE} cy={CENTRE} r={CENTRE - 4} fill="var(--color-surface-2)" />

        {value !== "" && (
          <g>
            <line
              x1={CENTRE}
              y1={CENTRE}
              x2={tip.x}
              y2={tip.y}
              stroke="var(--color-accent)"
              strokeWidth="2"
            />
            {/* Sized to clear the ring next to it: any wider and the selected
                hour sits on top of the labels on the other ring. */}
            <circle cx={tip.x} cy={tip.y} r="15" fill="var(--color-accent)" />
          </g>
        )}
        <circle cx={CENTRE} cy={CENTRE} r="3" fill="var(--color-accent)" />

        {marks.map((mark) => {
          const p = polar(mark.r, mark.deg);
          return (
            <text
              key={mark.v}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none tabular-nums"
              fontSize={mark.r === R_PM ? 11 : 13}
              fontWeight={mark.on ? 600 : 400}
              fill={
                mark.on
                  ? "var(--color-on-accent)"
                  : mark.r === R_PM
                    ? "var(--color-ink-faint)"
                    : "var(--color-ink-dim)"
              }
            >
              {mark.label}
            </text>
          );
        })}
      </svg>

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            write(now.getHours(), (Math.round(now.getMinutes() / 5) * 5) % 60);
            setMode("minute");
          }}
          className="flex-1 rounded-lg bg-surface-2 py-1.5 text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          Now
        </button>
        <button
          type="button"
          onClick={() => {
            onChange("");
            onDone();
          }}
          className="flex-1 rounded-lg bg-surface-2 py-1.5 text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          Anytime
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={!value}
          className="flex-1 rounded-lg bg-accent py-1.5 text-[11px] font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Set
        </button>
      </div>
    </div>
  );
}

function Segment({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg px-1.5 transition-colors ${
        on ? "bg-accent/15 text-accent-soft" : "text-ink-faint hover:text-ink-dim"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------------- helpers -------------------------------- */

function Step({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-7 place-items-center rounded-lg border border-line text-ink-dim transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

export function relativeLabel(date: LocalDate, now: LocalDate = today()): string {
  if (date === now) return "Today";
  if (date === addDays(now, 1)) return "Tomorrow";
  if (date === addDays(now, -1)) return "Yesterday";
  return PRETTY.format(parseLocalDate(date));
}

function shiftMonth(date: LocalDate, delta: number): LocalDate {
  const d = parseLocalDate(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Six Monday-first weeks covering the month that `date` falls in. */
export function monthGrid(date: LocalDate): { date: LocalDate; inMonth: boolean }[] {
  const d = parseLocalDate(date);
  const month = d.getMonth();
  const first = new Date(d.getFullYear(), month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(d.getFullYear(), month, 1 - lead);

  return Array.from({ length: 42 }, (_, i) => {
    const cell = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(
      cell.getDate(),
    ).padStart(2, "0")}`;
    return { date: iso, inMonth: cell.getMonth() === month };
  });
}
