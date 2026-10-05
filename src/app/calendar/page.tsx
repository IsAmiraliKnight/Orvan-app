"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AddTaskSheet } from "@/components/AddTaskSheet";
import { ColorPicker } from "@/components/ColorPicker";
import { DatePicker, TimePicker, relativeLabel } from "@/components/DateField";
import { TopBar } from "@/components/TopBar";
import { RepeatGlyph } from "@/components/ui";
import { addDays, parseLocalDate, today } from "@/lib/domain/dates";
import { swatch, tint } from "@/lib/domain/palette";
import { RECURRENCES, sameRecurrence } from "@/lib/domain/recurrence";
import type { LocalDate, Priority, Project, Recurrence, Task } from "@/lib/domain/types";
import { useOrvan, type NewTaskInput } from "@/lib/store/store";

/** A full day. Anyone who trains at 6am or writes at 1am needs the row to exist. */
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ROW_H = 52;
/** Quarter-hour steps: fine enough to be honest, coarse enough to hit. */
const SNAP_MIN = 15;
/** What a tap with no drag means. Drawing a range overrides it. */
const DEFAULT_MIN = 60;

/** The hour-label column. Fixed, because it is the same in every window. */
const GUTTER = 56;
/** How long the window takes to glide into place once the finger lets go. */
const GLIDE_MS = 340;

/** `py-4` on the page container, doubled for the border rounding either side. */
const PAGE_PAD = 20;
/** Matches the shell's `pb` under `md`, which reserves room for MobileNav. */
const BOTTOM_BAR_CLEARANCE = 84;

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "var(--color-p-high)",
  medium: "var(--color-p-med)",
  low: "var(--color-p-low)",
};

type Span = 1 | 3 | 7;
const SPANS: ReadonlyArray<readonly [Span, string]> = [
  [1, "Day"],
  [3, "3 days"],
  [7, "Week"],
];

/** The days belonging to one window of the carousel: 0 before, 1 shown, 2 after. */
function window_(days: LocalDate[], span: Span, index: number): LocalDate[] {
  return days.slice(index * span, (index + 1) * span);
}

/** Category first, then the project it belongs to, then priority as a floor. */
function eventColor(task: Task, projects: Project[]): string {
  return (
    swatch(task.colorKey)?.color ??
    projects.find((p) => p.id === task.projectId)?.color ??
    PRIORITY_COLOR[task.priority]
  );
}

/* ------------------------------ slot geometry ----------------------------- */

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function clockOf(minutes: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function snap(minutes: number): number {
  return Math.max(0, Math.min(1440 - SNAP_MIN, Math.round(minutes / SNAP_MIN) * SNAP_MIN));
}

interface Placed {
  task: Task;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/**
 * Side-by-side placement for events that overlap.
 *
 * Drawing your own slots makes collisions ordinary rather than exceptional, and
 * stacked absolute blocks would simply hide the earlier one. Overlapping events
 * are split into clusters and each cluster shares its width.
 */
function layout(tasks: Task[]): Placed[] {
  const items = tasks
    .map((task) => {
      const start = minutesOf(task.dueTime!);
      return { task, start, end: start + (task.durationMin ?? DEFAULT_MIN), lane: 0 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: Placed[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = Math.max(...cluster.map((i) => i.lane)) + 1;
    for (const i of cluster) {
      out.push({
        task: i.task,
        top: (i.start / 60) * ROW_H,
        // A 15-minute block is 13px tall; floor it so the title still fits.
        height: Math.max(24, ((i.end - i.start) / 60) * ROW_H - 3),
        lane: i.lane,
        lanes,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.end > item.start).map((c) => c.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    item.lane = lane;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();

  return out;
}

export default function CalendarPage() {
  const { state, ready, addTask, ensureRecurringTasksThrough, completeTask, reopenTask } =
    useOrvan();
  const day = today();

  /**
   * The leftmost column, not the start of the calendar week. Opening on
   * Monday when it is Thursday buries today in the middle of the grid and
   * spends three columns on days that are already gone.
   */
  const [anchor, setAnchor] = useState<LocalDate>(day);
  const [span, setSpan] = useState<Span>(7);
  const [selected, setSelected] = useState<LocalDate>(day);
  const [panelOpen, setPanelOpen] = useState(true);
  const [query, setQuery] = useState("");

  const timeline = useRef<HTMLDivElement>(null);
  /** Measured on the client; null means "let the stylesheet decide". */
  const [gridHeight, setGridHeight] = useState<number | null>(null);
  /**
   * The timeline's scrollbar, in pixels, reserved on the two rows above it.
   *
   * Only the timeline scrolls, so only the timeline loses width to a scrollbar
   * — which left its columns a couple of pixels narrower than the dates over
   * them, and would put the header and the grid on different offsets the
   * moment the whole thing started sliding.
   */
  const [scrollbar, setScrollbar] = useState(0);

  /** The range being drawn right now, in minutes from midnight. */
  const [drag, setDrag] = useState<{ date: LocalDate; from: number; to: number } | null>(null);
  /** The finished range, handed to the composer. */
  const [draft, setDraft] = useState<{ date: LocalDate; time: string; minutes: number } | null>(
    null,
  );
  const moved = useRef(false);
  const downY = useRef(0);
  /** Sideways travel on the same press — navigation rather than a new slot. */
  const downX = useRef(0);
  const swiping = useRef(false);

  /*
   * The days are a carousel, not a jump.
   *
   * Three windows are laid out side by side and the middle one is what you
   * see; `slide` moves all of them together, in pixels. While a finger is down
   * it is the raw travel, so the columns are under the fingertip rather than
   * flicking a window at a time. On release it animates to the neighbour, and
   * once it lands the anchor moves by a window and the offset resets — the
   * content either side is identical, so the swap is invisible.
   */
  const [slide, setSlide] = useState(0);
  const [gliding, setGliding] = useState(false);
  const landing = useRef(0);

  /** The width of one window: the card, less the fixed hour column. */
  const windowWidth = useCallback(() => {
    return Math.max(1, (timeline.current?.clientWidth ?? 0) - GUTTER);
  }, []);

  /** Past this the window changes; short of it, it springs back. */
  const commitAt = useCallback(() => Math.min(windowWidth() / 4, 90), [windowWidth]);

  const slideTo = useCallback(
    (dir: -1 | 0 | 1) => {
      window.clearTimeout(landing.current);
      setGliding(true);
      setSlide(dir === 0 ? 0 : -dir * windowWidth());
      if (dir === 0) return;
      landing.current = window.setTimeout(() => {
        // One commit: the anchor moves a window forward at the same moment the
        // offset returns to the middle, so nothing is ever drawn out of place.
        setGliding(false);
        setSlide(0);
        setAnchor((a) => addDays(a, dir * span));
      }, GLIDE_MS);
    },
    [span, windowWidth],
  );

  useEffect(() => () => window.clearTimeout(landing.current), []);

  /**
   * Both of these depend on the viewport, so they run after mount: the exported
   * markup has to be identical for every visitor.
   *
   * Seven columns need roughly 90px each to stay legible. Below a tablet there
   * is no honest way to fit them, so the window narrows instead of the columns.
   */
  useEffect(() => {
    const w = window.innerWidth;
    if (w < 1024) setSpan(3);
    // Only below `md`, where the panel is a drawer over the grid rather than a
    // column beside it. A phone held sideways is ~844px: wide enough to dock,
    // and it is exactly the case where the space would otherwise sit empty.
    if (w < 768) setPanelOpen(false);
  }, []);

  /*
   * Give the grid whatever height is left between its own top edge and the
   * bottom of the screen.
   *
   * A flex `flex-1` cannot do this: nothing above the grid has a definite
   * height — the shell is `min-h-dvh`, a floor rather than a ceiling — so the
   * grid grew to its full 1248px and pushed the page into scrolling instead.
   * Measuring is the honest way to get "the rest of the screen" here.
   */
  useEffect(() => {
    const el = timeline.current;
    if (!el) return;

    const measure = () => {
      setScrollbar(el.offsetWidth - el.clientWidth);
      // From `lg` the panel sits beside the grid and the stylesheet rule fits.
      if (window.innerWidth >= 1024) {
        setGridHeight(null);
        return;
      }
      // Distance from the document top, so the answer does not depend on where
      // the page happens to be scrolled while we measure.
      const top = el.getBoundingClientRect().top + window.scrollY;
      /*
       * Everything laid out below the grid: the page's own bottom padding, and
       * below `md` the shell's clearance for the floating bottom bar. Deriving
       * this from `scrollHeight` looked tidier but does not work — once the
       * page stops overflowing, `scrollHeight` clamps to the viewport and the
       * measurement can settle on a height that is too short.
       */
      const below = window.innerWidth < 768 ? PAGE_PAD + BOTTOM_BAR_CLEARANCE : PAGE_PAD + 24;
      setGridHeight(Math.max(260, window.innerHeight - top - below));
    };

    measure();
    // Converges: setting the height changes the page height, which fires the
    // observer once more, and the grid's own top edge has not moved.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ready]);

  /*
   * A 24-hour grid is 1248px tall; landing at midnight would show an empty
   * night and hide every task. Open just above the current hour instead.
   *
   * Waits for the grid to actually be scrollable — until the measured height
   * lands it is still full size, and a scroll into a box with no overflow is
   * silently a no-op. Fires once, so a later resize does not yank someone back
   * to now while they are reading another part of the day.
   */
  const homed = useRef(false);
  useEffect(() => {
    const el = timeline.current;
    if (!el || homed.current || el.scrollHeight <= el.clientHeight) return;
    // Explicitly instant: the container scrolls smoothly, and animating 600px
    // on arrival would read as the page still loading.
    el.scrollTo({ top: Math.max(0, (new Date().getHours() - 1) * ROW_H), behavior: "instant" });
    homed.current = true;
  }, [ready, gridHeight]);

  /*
   * A two-finger sideways swipe on a trackpad drags the same carousel the
   * finger does: the columns track the gesture, and when it stops they settle
   * onto the nearer window.
   *
   * A wheel has no "end" event, so the settle is on a short idle instead.
   * Registered by hand because the listener has to be non-passive: without the
   * `preventDefault` the same gesture triggers the browser's back navigation.
   */
  useEffect(() => {
    const el = timeline.current;
    if (!el) return;

    let travel = 0;
    let idle = 0;

    const onWheel = (e: WheelEvent) => {
      // Vertical intent wins outright, so scrolling the day never slides it.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const w = windowWidth();
      // Scrolling right is "later", which moves the columns left.
      travel = Math.max(-w, Math.min(w, travel - e.deltaX));
      setGliding(false);
      setSlide(travel);

      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        const past = Math.abs(travel) > commitAt();
        const dir = past ? (travel < 0 ? 1 : -1) : 0;
        travel = 0;
        slideTo(dir);
      }, 90);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(idle);
    };
  }, [ready, commitAt, slideTo, windowWidth]);

  /** Every rendered day: the window before, the one on screen, the one after. */
  const days = useMemo(
    () => Array.from({ length: span * 3 }, (_, i) => addDays(anchor, i - span)),
    [anchor, span],
  );
  /** Only the middle window — what "on screen" means to everything else. */
  const shown = useMemo(() => days.slice(span, span * 2), [days, span]);

  useEffect(() => {
    if (!ready) return;
    ensureRecurringTasksThrough(days[days.length - 1]);
  }, [ready, days, state.tasks, ensureRecurringTasksThrough]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.tasks.filter((t) => !q || t.title.toLowerCase().includes(q));
  }, [state.tasks, query]);

  const byDay = useMemo(() => {
    const map = new Map<LocalDate, { timed: Task[]; anytime: Task[] }>();
    for (const d of days) map.set(d, { timed: [], anytime: [] });
    for (const t of visible) {
      const bucket = t.dueDate ? map.get(t.dueDate) : undefined;
      if (!bucket) continue;
      (t.dueTime ? bucket.timed : bucket.anytime).push(t);
    }
    return map;
  }, [visible, days]);

  const busyDays = useMemo(() => {
    const set = new Set<LocalDate>();
    for (const t of state.tasks) if (t.dueDate) set.add(t.dueDate);
    return set;
  }, [state.tasks]);

  function toggle(t: Task) {
    if (t.status === "done") reopenTask(t.id);
    else completeTask(t.id);
  }

  /* --------------------------- draw a slot --------------------------- */

  function minutesAt(el: HTMLElement, clientY: number): number {
    return snap(((clientY - el.getBoundingClientRect().top) / ROW_H) * 60);
  }

  function startDraw(e: React.PointerEvent<HTMLDivElement>, d: LocalDate) {
    // Left button only, and never when the press landed on an event.
    if (e.button !== 0) return;
    moved.current = false;
    swiping.current = false;
    downY.current = e.clientY;
    downX.current = e.clientX;
    const from = minutesAt(e.currentTarget, e.clientY);
    setDrag({ date: d, from, to: from + DEFAULT_MIN });
    // Keeps the drag alive when the pointer leaves the column. Not every
    // pointer id can be captured, and failing to is not worth an exception.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the drag still works, it just stops at the column edge */
    }
  }

  function moveDraw(e: React.PointerEvent<HTMLDivElement>) {
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    const w = windowWidth();

    // Already swiping: the columns follow the finger one-to-one, clamped to the
    // window either side because that is all there is rendered to show.
    if (swiping.current) {
      setSlide(Math.max(-w, Math.min(w, dx)));
      return;
    }

    if (!drag) return;

    // Sideways first: a horizontal drag is "show me another day", so it has to
    // claim the gesture before the vertical threshold turns it into a slot.
    if (!moved.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      swiping.current = true;
      setGliding(false);
      setDrag(null);
      setSlide(dx);
      return;
    }

    // A few pixels of travel is a press, not a drag — otherwise a tap on a
    // touch screen would create a 15-minute sliver.
    if (!moved.current && Math.abs(dy) < 5) return;
    moved.current = true;
    setDrag({ ...drag, to: minutesAt(e.currentTarget, e.clientY) });
  }

  function endDraw(e: React.PointerEvent<HTMLDivElement>) {
    if (swiping.current) {
      swiping.current = false;
      const dx = e.clientX - downX.current;
      // Far enough is a page turn; anything shorter glides back where it was,
      // so a half-hearted drag never loses the day you were looking at.
      slideTo(Math.abs(dx) > commitAt() ? (dx < 0 ? 1 : -1) : 0);
      return;
    }
    if (!drag) return;
    const from = moved.current ? Math.min(drag.from, drag.to) : drag.from;
    const to = moved.current ? Math.max(drag.from, drag.to) : drag.from + DEFAULT_MIN;
    setDraft({
      date: drag.date,
      time: clockOf(from),
      minutes: Math.max(SNAP_MIN, to - from),
    });
    setDrag(null);
  }

  function jumpTo(d: LocalDate) {
    setSelected(d);
    // Keep the chosen day on screen without dragging today off the left edge
    // when it is already visible.
    if (!shown.includes(d)) setAnchor(d);
  }

  if (!ready) return <div className="flex-1 animate-pulse bg-bg" aria-label="Loading" />;

  return (
    <>
      <TopBar
        title="Calendar"
        subtitle={MONTH.format(parseLocalDate(anchor))}
        wideAction
        action={
          <div className="flex items-center gap-1.5">
            {/* Glides rather than cuts, so the arrows and the swipe are the
                same movement seen twice. */}
            <StepButton label={`Back ${span} days`} onClick={() => slideTo(-1)}>
              ‹
            </StepButton>
            <button
              type="button"
              onClick={() => {
                setAnchor(day);
                setSelected(day);
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
            >
              Today
            </button>
            <StepButton label={`Forward ${span} days`} onClick={() => slideTo(1)}>
              ›
            </StepButton>

            {/* Hidden on the narrowest screens: the window is already forced. */}
            <div className="ms-1 hidden rounded-lg border border-line p-0.5 sm:flex">
              {SPANS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpan(value)}
                  aria-pressed={span === value}
                  className={`rounded-[6px] px-2 py-1 text-[11px] transition-colors ${
                    span === value
                      ? "bg-accent font-medium text-on-accent"
                      : "text-ink-dim hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-pressed={panelOpen}
              aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
              className={`ms-1 grid size-8 place-items-center rounded-lg border transition-colors ${
                panelOpen
                  ? "border-accent/40 bg-accent/15 text-accent-soft"
                  : "border-line text-ink-dim hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                <rect
                  x="2.5"
                  y="3.5"
                  width="15"
                  height="13"
                  rx="2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path d="M12.5 3.5v13" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
        }
      />

      {/*
        Below `md` the page itself does not scroll: the grid is sized to the
        space that is left and does its own scrolling inside. From `md` up the
        panel sits beside it and the old top-aligned row layout is right again.
      */}
      <div className="mx-auto flex w-full max-w-[100rem] min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 md:flex-row md:items-start lg:gap-5">
        {/* `flex-1` only in the row layout — in the mobile column it would
            stretch the card past the grid and put the empty space back. */}
        <section className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface md:min-w-0 md:flex-1">
          <div
            className="flex shrink-0 overflow-hidden border-b border-line"
            style={{ paddingInlineEnd: scrollbar }}
          >
            <span className="shrink-0" style={{ width: GUTTER }} />
            <Track span={span} slide={slide} gliding={gliding}>
              {(w) =>
                window_(days, span, w).map((d) => {
                  const date = parseLocalDate(d);
                  const isToday = d === day;
                  const relative = relativeLabel(d, day);
                  // "Today" and "Tomorrow" replace the weekday outright rather
                  // than sitting next to it — two labels for one column read as
                  // two days.
                  const named = relative === "Today" || relative === "Tomorrow";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelected(d)}
                      className={`flex min-w-0 flex-col items-center gap-1 border-s border-line py-2.5 transition-colors hover:bg-surface-2 ${
                        selected === d ? "bg-surface-2" : ""
                      }`}
                    >
                      <span
                        className={`w-full truncate px-1 text-center text-[10px] uppercase tracking-wider sm:text-[11px] ${
                          named ? "font-medium text-accent-soft" : "text-ink-faint"
                        }`}
                      >
                        {named ? relative : WEEKDAY[(date.getDay() + 6) % 7]}
                      </span>
                      <span
                        className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${
                          isToday ? "bg-accent font-semibold text-on-accent" : "text-ink"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })
              }
            </Track>
          </div>

          {/*
            Untimed tasks have no slot on the timeline, so they get their own
            strip — capped, because it sits above the grid and a day with eight
            loose tasks would otherwise push the hours off the screen.
          */}
          <div
            className="no-scrollbar flex max-h-[4.5rem] shrink-0 overflow-y-auto overflow-x-hidden border-b border-line bg-surface-2/40 md:max-h-[7rem]"
            style={{ paddingInlineEnd: scrollbar }}
          >
            <span
              className="shrink-0 py-2 pe-2 text-end text-[10px] uppercase tracking-wider text-ink-faint"
              style={{ width: GUTTER }}
            >
              any
            </span>
            <Track span={span} slide={slide} gliding={gliding}>
              {(w) =>
                window_(days, span, w).map((d) => (
                  <div key={d} className="flex min-w-0 flex-col gap-1 border-s border-line p-1.5">
                    {byDay.get(d)?.anytime.map((t) => (
                      <Chip key={t.id} task={t} projects={state.projects} onToggle={toggle} />
                    ))}
                  </div>
                ))
              }
            </Track>
          </div>

          {/*
            Takes whatever height is left rather than a fixed cap, so a tall
            phone shows more hours instead of dead space under the grid.
            `overscroll-contain` stops a flick at either end from handing the
            scroll to the page behind it, which is most of what made this feel
            stiff on a touch screen.
          */}
          <div
            ref={timeline}
            style={gridHeight ? { height: gridHeight } : undefined}
            className="momentum-scroll relative flex overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth lg:max-h-[calc(100dvh-19rem)]"
          >
            <div className="shrink-0" style={{ width: GUTTER }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{ height: ROW_H }}
                  className="pe-2 text-end text-[11px] text-ink-faint tabular-nums"
                >
                  <span className="relative -top-1.5">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>

            <Track span={span} slide={slide} gliding={gliding}>
              {(w) =>
                window_(days, span, w).map((d) => {
                  const drawing = drag?.date === d ? drag : null;
                  return (
                    /*
                     * The column is the canvas: press anywhere empty and drag to
                     * draw a slot, exactly as a desktop calendar behaves. There is
                     * deliberately no `touch-action: none` — on a phone a vertical
                     * pan has to stay a scroll, so there a tap creates the default
                     * hour instead and a drag scrolls. A sideways drag is the
                     * exception: it changes the days rather than drawing, and
                     * `touch-pan-y` is what claims it on a touch screen — without
                     * it the browser takes the horizontal gesture for itself and
                     * the swipe never reaches this column at all.
                     */
                    <div
                      key={d}
                      className="relative min-w-0 cursor-cell touch-pan-y border-s border-line"
                      onPointerDown={(e) => startDraw(e, d)}
                      onPointerMove={moveDraw}
                      onPointerUp={endDraw}
                      onPointerCancel={() => {
                        swiping.current = false;
                        setDrag(null);
                      }}
                    >
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          style={{ height: ROW_H }}
                          className="border-b border-line/60"
                        />
                      ))}
                      {d === day && <NowLine />}

                      {drawing && (
                        <div
                          className="pointer-events-none absolute inset-x-1 z-30 rounded-lg border border-accent bg-accent/25 px-1.5 py-1"
                          style={{
                            top: (Math.min(drawing.from, drawing.to) / 60) * ROW_H,
                            height: Math.max(
                              22,
                              (Math.abs(drawing.to - drawing.from) / 60) * ROW_H - 3,
                            ),
                          }}
                        >
                          <span className="block text-[10px] font-medium text-accent-soft tabular-nums">
                            {clockOf(Math.min(drawing.from, drawing.to))} –{" "}
                            {clockOf(Math.max(drawing.from, drawing.to))}
                          </span>
                        </div>
                      )}

                      {layout(byDay.get(d)?.timed ?? []).map((p) => (
                        <Event
                          key={p.task.id}
                          placed={p}
                          // A week column is ~50px wide. Halving that for a
                          // collision leaves room for about two letters, so
                          // there they stagger instead of splitting.
                          stagger={span === 7}
                          projects={state.projects}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  );
                })
              }
            </Track>
          </div>
        </section>

        {panelOpen && (
          <>
            {/* Below md the panel covers the calendar, so it needs a way out. */}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Close side panel"
              className="fixed inset-0 z-40 bg-shade/60 backdrop-blur-sm md:hidden"
            />
            <SidePanel
              selected={selected}
              onSelect={jumpTo}
              query={query}
              onQuery={setQuery}
              busyDays={busyDays}
              projects={state.projects}
              onAdd={addTask}
              onClose={() => setPanelOpen(false)}
            />
          </>
        )}
      </div>

      {/* The composer the drawn slot hands off to — same sheet as everywhere
          else, pre-filled with the range instead of asking for it again. */}
      <AddTaskSheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        onSubmit={(input) => {
          addTask(input);
          setDraft(null);
        }}
        defaultDate={draft?.date}
        defaultTime={draft?.time}
        defaultDurationMin={draft?.minutes}
      />
    </>
  );
}

/**
 * One row of the carousel: three windows of days, sitting side by side.
 *
 * The header, the untimed strip and the timeline are three separate rows of
 * the same grid, so each gets its own track and they are given the same offset
 * — that is what keeps the date, its loose tasks and its hours moving as one
 * thing. The hour column is not in here on purpose: it is identical in every
 * window, so sliding it would be motion that says nothing.
 *
 * `300%` is measured against the wrapper, which is what is left of the card
 * after the hour column, so one window is exactly the visible width. The
 * `-33.3333%` parks the middle one; `slide` is added on top in pixels.
 */
function Track({
  span,
  slide,
  gliding,
  children,
}: {
  span: Span;
  slide: number;
  gliding: boolean;
  /** Given a window index, the cells for that window's days. */
  children: (window: number) => React.ReactNode;
}) {
  return (
    /*
     * The clip has to be here rather than on the row, or the window before this
     * one shows through on top of the hour labels — the row is wider than the
     * days by exactly that column.
     *
     * `self-start` is what makes that safe vertically. Stretched, the timeline's
     * copy of this would take the height of the scroll *viewport* rather than
     * of the day, and clipping to that erases every hour below the fold.
     */
    <div className="min-w-0 flex-1 self-start overflow-hidden">
      <div
        className="grid w-[300%]"
        style={{
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          transform: `translateX(calc(-33.3333% + ${slide}px))`,
          // No transition while a finger is down: the columns have to be where
          // the finger is, not easing towards it.
          transition: gliding
            ? `transform ${GLIDE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
            : "none",
          // Only while it is actually moving — a permanent promotion would keep
          // three full grids on their own layers for the whole session.
          willChange: gliding || slide !== 0 ? "transform" : undefined,
        }}
      >
        {[0, 1, 2].map((w) => (
          /*
           * The two windows off screen are `inert`: they are full of real
           * buttons, and tabbing into one would make the browser scroll the
           * track sideways to reveal it — which the transform then fights,
           * leaving the grid permanently out of line with its own headers.
           */
          <div
            key={w}
            inert={w !== 1}
            className="grid"
            style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}
          >
            {children(w)}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepButton({
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
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-dim transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

function NowLine() {
  const now = new Date();
  const top = ((now.getHours() * 60 + now.getMinutes()) / 60) * ROW_H;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }} aria-hidden="true">
      <span className="absolute -start-1 -top-1 size-2 rounded-full bg-accent" />
      <span className="block h-px bg-accent" />
    </div>
  );
}

function Event({
  placed,
  stagger,
  projects,
  onToggle,
}: {
  placed: Placed;
  stagger: boolean;
  projects: Project[];
  onToggle: (t: Task) => void;
}) {
  const { task, top, height, lane, lanes } = placed;
  const color = eventColor(task, projects);
  const done = task.status === "done";
  const ends = clockOf(minutesOf(task.dueTime!) + (task.durationMin ?? DEFAULT_MIN));

  return (
    <button
      type="button"
      onClick={() => onToggle(task)}
      // Without this the press would also start drawing a new slot underneath.
      onPointerDown={(e) => e.stopPropagation()}
      title={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
      className={`absolute overflow-hidden rounded-lg border p-1.5 text-start shadow-lg shadow-shade/15 transition-transform hover:-translate-y-0.5 ${
        done ? "opacity-45" : ""
      }`}
      style={{
        top: Math.max(0, top),
        height,
        // Overlapping events share the column rather than covering each other —
        // side by side where there is room, cascaded where there is not.
        zIndex: 10 + lane,
        ...(stagger
          ? { insetInlineStart: 2 + lane * 8, insetInlineEnd: 2 }
          : {
              insetInlineStart: `calc(${(lane / lanes) * 100}% + 2px)`,
              width: `calc(${100 / lanes}% - 4px)`,
            }),
        // The iOS Calendar read: a wash of the category colour with a saturated
        // spine, rather than a neutral card with a colour dot on it.
        background: tint(color, 18),
        borderColor: tint(color, 42),
      }}
    >
      <span
        className="absolute inset-y-1 start-0 w-[3px] rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span
        className={`ms-1.5 flex items-center gap-1 truncate text-[11px] font-medium leading-tight ${
          done ? "line-through" : ""
        }`}
      >
        {task.recurrence && <RepeatGlyph />}
        <span className="truncate">{task.title}</span>
      </span>
      {/* Only once the block is tall enough that the range is not squeezing
          the title out of its own event. */}
      {height >= 34 && (
        <span className="ms-1.5 block text-[10px] text-ink-faint tabular-nums">
          {task.dueTime} – {ends}
        </span>
      )}
    </button>
  );
}

function Chip({
  task,
  projects,
  onToggle,
}: {
  task: Task;
  projects: Project[];
  onToggle: (t: Task) => void;
}) {
  const color = eventColor(task, projects);
  const done = task.status === "done";
  return (
    <button
      type="button"
      onClick={() => onToggle(task)}
      className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-start transition-opacity hover:opacity-80 ${
        done ? "opacity-45" : ""
      }`}
      style={{ background: tint(color, 16) }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className={`truncate text-[10px] ${done ? "line-through" : ""}`}>{task.title}</span>
    </button>
  );
}

/* ------------------------------- side panel ------------------------------ */

function SidePanel({
  selected,
  onSelect,
  query,
  onQuery,
  busyDays,
  projects,
  onAdd,
  onClose,
}: {
  selected: LocalDate;
  onSelect: (d: LocalDate) => void;
  query: string;
  onQuery: (q: string) => void;
  busyDays: Set<LocalDate>;
  projects: Project[];
  onAdd: (input: NewTaskInput) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(undefined);
  const [colorKey, setColorKey] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    // The form writes to the selected day, so the calendar and the form can
    // never disagree about what "the date" is.
    onAdd({
      title,
      priority,
      dueDate: selected,
      dueTime: time || undefined,
      durationMin: DEFAULT_MIN,
      colorKey,
      projectId,
      recurrence,
    });
    setTitle("");
    setTime("");
  }

  const active = projects.filter((p) => p.status === "active");

  return (
    /*
     * Docked from `md` rather than `lg` on purpose: a phone held sideways is
     * ~844px wide and was leaving a wide empty strip beside the grid while the
     * panel stayed a drawer.
     */
    <aside className="animate-slide-in-end fixed inset-y-0 end-0 z-50 flex w-[min(20rem,88vw)] shrink-0 flex-col gap-4 overflow-y-auto border-s border-accent/20 bg-bg p-4 md:sticky md:inset-y-auto md:top-[5.5rem] md:z-auto md:max-h-[calc(100dvh-7rem)] md:w-[17.5rem] md:rounded-2xl md:border md:bg-accent-deep/15 lg:w-[20rem] xl:w-[21rem]">
      <button
        type="button"
        onClick={onClose}
        className="-mt-1 self-end rounded-lg px-2 py-1 text-xs text-ink-dim hover:text-ink md:hidden"
      >
        Close ✕
      </button>

      <label className="flex items-center gap-2 rounded-full border border-accent/25 bg-surface-2/60 px-4 py-2.5 md:bg-bg/40">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-accent-soft" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
      </label>

      <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm font-medium">
          Add to <span className="text-accent-soft">{relativeLabel(selected)}</span>
        </p>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Task title"
          className="w-full border-b border-line bg-transparent pb-2 text-sm outline-none placeholder:text-ink-faint focus:border-accent"
        />

        <div className="mt-3 flex gap-2">
          <DatePicker value={selected} onChange={onSelect} markedDates={busyDays} />
          <TimePicker value={time} onChange={setTime} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {RECURRENCES.map(([label, r]) => (
            <MiniChip
              key={label}
              label={label === "Never" ? "Once" : label}
              on={sameRecurrence(recurrence, r)}
              onClick={() => setRecurrence(r)}
            />
          ))}
        </div>

        <div className="mt-4">
          <ColorPicker value={colorKey} onChange={setColorKey} />
        </div>

        {active.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <MiniChip label="No project" on={!projectId} onClick={() => setProjectId(undefined)} />
            {active.map((p) => (
              <MiniChip
                key={p.id}
                label={p.name}
                on={projectId === p.id}
                onClick={() => setProjectId(p.id)}
              />
            ))}
          </div>
        )}

        {recurrence ? (
          <p className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-[10px] leading-relaxed text-accent-soft">
            Repeats always pay the Medium rate. Each scheduled day appears automatically.
          </p>
        ) : (
          <div className="mt-4 flex gap-1.5">
            {(["high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 rounded-lg py-1.5 text-[11px] capitalize transition-colors ${
                  priority === p
                    ? "bg-accent text-on-accent"
                    : "bg-surface-2 text-ink-dim hover:text-ink"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!title.trim()}
          className="mt-4 w-full rounded-lg bg-accent py-2 text-xs font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Add task
        </button>
      </form>

      <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-[11px] leading-relaxed text-ink-faint">
        Or draw it: drag down the grid to block out a range, or tap an empty hour for a one-hour
        slot. Swipe sideways — or scroll sideways — to move between days.
      </p>
    </aside>
  );
}

function MiniChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-[9rem] truncate rounded-full px-2.5 py-1 text-[10px] transition-colors ${
        on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
