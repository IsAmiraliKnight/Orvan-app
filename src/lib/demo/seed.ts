import { addDays, today } from "@/lib/domain/dates";
import type { AppState, Goal, Priority, Task, XpEvent } from "@/lib/domain/types";

/**
 * A demo account, built relative to whatever "today" is when it first runs.
 *
 * The app stores everything in localStorage, so a fresh browser starts empty —
 * which makes the heatmap, the charts and the league standing all render as
 * nothing. That is fine for a real first-run, but it is the wrong first
 * impression when the build is being shown to someone. Seeding on an empty
 * store means the link looks the same wherever it is opened.
 */

/**
 * Task XP per day, oldest first, ending on today. Shaped by hand rather than
 * generated: the rest days and the ramp are what make the heatmap read like
 * someone's real month instead of noise.
 *
 * Today is deliberately the smallest number in the run. Seeding it near the
 * daily cap left almost no priority slots free, so the first task anyone ticked
 * in a demo awarded 0 XP and the level ring sat still — the caps working
 * exactly as designed, and looking exactly like a dead chart.
 */
const DAILY_XP = [
  0, 4, 7, 0, 3, 9, 8, 0, 5, 11, 6, 3, 0, 8,
  12, 5, 0, 7, 14, 9, 4, 0, 0, 13, 6, 9, 15, 3,
];

const PRIORITY_XP: ReadonlyArray<readonly [Priority, number]> = [
  ["high", 3],
  ["medium", 2],
  ["low", 1],
];

const PRIORITY_CAP: Record<Priority, number> = { high: 3, medium: 5, low: 99 };

/** Split a day's XP into plausible task completions that respect the caps. */
function taskEventsFor(date: string, total: number, seq: () => string): XpEvent[] {
  const events: XpEvent[] = [];
  let left = total;

  for (const [priority, xp] of PRIORITY_XP) {
    for (let n = 0; n < PRIORITY_CAP[priority] && left >= xp; n += 1) {
      events.push({
        id: seq(),
        source: "task",
        amount: xp,
        priority,
        date,
        createdAt: `${date}T09:00:00.000Z`,
      });
      left -= xp;
    }
  }

  return events;
}

function buildXpEvents(day: string): XpEvent[] {
  let n = 0;
  const seq = () => `xp${(n += 1)}`;
  const events: XpEvent[] = [];
  const dateAt = (i: number) => addDays(day, i - (DAILY_XP.length - 1));

  DAILY_XP.forEach((total, i) => {
    events.push(...taskEventsFor(dateAt(i), total, seq));
  });

  // Quest and streak payouts sit on top of the task cap, so they are added
  // separately rather than folded into the daily totals above.
  const extra: ReadonlyArray<readonly [number, XpEvent["source"], number]> = [
    [9, "quest", 10],
    [18, "quest", 10],
    [10, "streak", 10],
    [19, "streak", 15],
  ];

  for (const [i, source, amount] of extra) {
    const date = dateAt(i);
    events.push({ id: seq(), source, amount, date, createdAt: `${date}T20:00:00.000Z` });
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function buildTasks(day: string): Task[] {
  const made = (date: string) => `${date}T08:00:00.000Z`;

  const rows: ReadonlyArray<{
    id: string;
    title: string;
    priority: Priority;
    offset: number;
    time?: string;
    minutes?: number;
    project?: string;
    color?: string;
    done?: boolean;
    /** Id of the row above it in the project outline. */
    parent?: string;
    repeat?: Task["recurrence"];
  }> = [
    // Today — the calendar and the home list both read from these. Times are
    // spread across the morning and evening so a 24-hour grid has something
    // outside office hours.
    { id: "t1", title: "Ship the pricing page copy", priority: "high", offset: 0, time: "09:30", minutes: 90, project: "p1", color: "sage" },
    { id: "t2", title: "Review onboarding flow", priority: "high", offset: 0, time: "11:00", minutes: 45, project: "p1", color: "sage", done: true },
    { id: "t3", title: "Reply to the beta testers", priority: "medium", offset: 0, time: "14:00", minutes: 30, project: "p1", color: "sage" },
    { id: "t4", title: "Gym — legs", priority: "medium", offset: 0, time: "18:30", minutes: 75, project: "p2", color: "coral" },
    { id: "t5", title: "Read 20 pages", priority: "low", offset: 0, time: "22:00", minutes: 30, color: "azure" },
    { id: "t6", title: "Drink 2L of water", priority: "low", offset: 0, project: "p2", color: "coral", done: true },

    // The outline: two steps under the pricing task, so the project modal
    // opens on a hierarchy rather than a flat list.
    { id: "t1a", title: "Draft the three tiers", priority: "high", offset: 0, project: "p1", color: "sage", parent: "t1", done: true },
    { id: "t1b", title: "Get the numbers signed off", priority: "high", offset: 0, project: "p1", color: "sage", parent: "t1" },

    // Repeats — one daily, one on weekdays. Both pay the Medium rate.
    { id: "r1", title: "Morning pages", priority: "medium", offset: 0, time: "07:00", minutes: 30, color: "azure", repeat: { kind: "daily" } },
    { id: "r2", title: "Stand-up", priority: "medium", offset: 0, time: "09:30", minutes: 15, project: "p1", color: "sage", repeat: { kind: "weekdays" } },

    // Rest of the week — gives the calendar grid something to show.
    { id: "t7", title: "Design review with Sara", priority: "high", offset: 1, time: "10:00", minutes: 60, project: "p1", color: "sage" },
    { id: "t8", title: "Meal prep for the week", priority: "medium", offset: 1, time: "17:00", minutes: 90, project: "p2", color: "coral" },
    { id: "t9", title: "Write the launch thread", priority: "medium", offset: 2, time: "13:00", minutes: 60, project: "p1", color: "sage" },
    { id: "t10", title: "Morning run", priority: "low", offset: 2, time: "06:30", minutes: 45, project: "p2", color: "coral" },
    { id: "t11", title: "Plan next sprint", priority: "high", offset: 3, time: "09:00", minutes: 120, project: "p1", color: "sage" },
    { id: "t12", title: "Call the dentist", priority: "low", offset: 4, color: "amber" },
    { id: "t17", title: "Dinner with Nima", priority: "low", offset: 2, time: "20:30", minutes: 120, color: "violet" },

    // Behind us — so the projects' progress rings are not at zero.
    { id: "t13", title: "Fix the signup redirect", priority: "high", offset: -1, project: "p1", color: "sage", done: true },
    { id: "t14", title: "Export the Q3 numbers", priority: "medium", offset: -1, project: "p1", color: "sage", done: true },
    { id: "t15", title: "Stretch 10 minutes", priority: "low", offset: -2, project: "p2", color: "coral", done: true },
    { id: "t16", title: "Sleep before midnight", priority: "medium", offset: -2, project: "p2", color: "coral", done: true },
  ];

  return rows.map((r) => {
    const date = addDays(day, r.offset);
    return {
      id: r.id,
      title: r.title,
      priority: r.priority,
      status: r.done ? "done" : "open",
      dueDate: date,
      dueTime: r.time,
      durationMin: r.minutes,
      projectId: r.project,
      colorKey: r.color,
      parentId: r.parent,
      recurrence: r.repeat,
      createdAt: made(addDays(date, -3)),
      completedAt: r.done ? `${date}T12:00:00.000Z` : undefined,
    };
  });
}

function buildGoals(day: string): Goal[] {
  const at = (offset: number) => addDays(day, offset);
  const made = `${addDays(day, -27)}T08:00:00.000Z`;

  return [
    { id: "g1", title: "Launch Orvan to 100 paying users", area: "work", targetDate: at(120), progress: 35, createdAt: made },
    { id: "g2", title: "Run a half marathon", area: "health", targetDate: at(210), progress: 20, createdAt: made },
    { id: "g3", title: "Six months of runway saved", area: "money", targetDate: at(300), progress: 55, createdAt: made },
  ];
}

export function buildDemoState(): AppState {
  const day = today();

  return {
    profile: {
      displayName: "Daniyal",
      avatarEmoji: "🦊",
      coinsBalance: 214,
      createdAt: `${addDays(day, -27)}T08:00:00.000Z`,
    },
    tasks: buildTasks(day),
    projects: [
      {
        id: "p1",
        name: "Launch Orvan",
        color: "#2ea98c",
        status: "active",
        createdAt: `${addDays(day, -27)}T08:00:00.000Z`,
      },
      {
        id: "p2",
        name: "Health",
        color: "#ffc53d",
        status: "active",
        createdAt: `${addDays(day, -20)}T08:00:00.000Z`,
      },
    ],
    xpEvents: buildXpEvents(day),
    streak: { current: 5, longest: 9, lastActiveDate: day, freezesOwned: 1 },
    // Finance stays empty on purpose. Every other number here is illustrative,
    // but a pre-filled ledger would be the one screen a viewer cannot read as
    // "this is what mine would look like" — it has to be their own entries.
    transactions: [],
    budgets: [],
    goals: buildGoals(day),
    onboarded: true,
  };
}
