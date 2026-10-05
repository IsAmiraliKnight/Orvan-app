"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { buildDemoState } from "@/lib/demo/seed";
import { today } from "@/lib/domain/dates";
import { levelFromTotalXp } from "@/lib/domain/level";
import { RECURRING_PRIORITY, materializeRecurrences } from "@/lib/domain/recurrence";
import { registerActivity } from "@/lib/domain/streak";
import { awardForTaskCompletion, totalXp } from "@/lib/domain/xp";
import type {
  AppState,
  Budget,
  Goal,
  GoalArea,
  LocalDate,
  Priority,
  Project,
  Recurrence,
  Task,
  Transaction,
  XpEvent,
} from "@/lib/domain/types";

/**
 * Whether this build starts a new browser on an empty account.
 *
 * The showcase build opens on a populated one, because a demo that opens on
 * blank charts shows nothing. A build handed to testers has to do the
 * opposite: their week is the data, so anything pre-filled is in the way.
 * Set `NEXT_PUBLIC_ORVAN_BLANK=1` at build time to get that build.
 */
const BLANK = process.env.NEXT_PUBLIC_ORVAN_BLANK === "1";

/*
 * The two builds keep separate storage. They are the same origin whenever both
 * are served from one host, and sharing the key would mean a tester who had
 * opened the demo first inherits its account instead of starting clean.
 */
const STORAGE_KEY = BLANK ? "orvan.state.v1.blank" : "orvan.state.v1";

const EMPTY_STATE: AppState = {
  profile: {
    displayName: "You",
    avatarEmoji: "🌱",
    coinsBalance: 0,
    createdAt: new Date().toISOString(),
  },
  tasks: [],
  projects: [],
  xpEvents: [],
  streak: { current: 0, longest: 0, freezesOwned: 0 },
  transactions: [],
  budgets: [],
  goals: [],
  onboarded: false,
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Feedback for the UI to animate after a completion. */
export interface CompletionResult {
  xp: number;
  reason: "full" | "priority_limit" | "daily_cap";
  bonusXp: number;
  leveledUpTo?: number;
}

interface OrvanContext {
  state: AppState;
  ready: boolean;
  addTask: (input: NewTaskInput) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  ensureRecurringTasksThrough: (date: LocalDate) => void;
  completeTask: (id: string) => CompletionResult | null;
  reopenTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addProject: (name: string, color: string) => void;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  deleteProject: (id: string) => void;
  addTransaction: (input: NewTransactionInput) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (category: string, limit: number) => void;
  addGoal: (input: { title: string; area: GoalArea; targetDate?: LocalDate }) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id">>) => void;
  deleteGoal: (id: string) => void;
  completeOnboarding: (profileName: string, emoji: string) => void;
  resetAll: () => void;
}

export interface NewTaskInput {
  title: string;
  priority: Priority;
  dueDate?: LocalDate;
  /** HH:mm. Absent means the task is "anytime" that day. */
  dueTime?: string;
  /** Minutes on the calendar. Only read when `dueTime` is set. */
  durationMin?: number;
  projectId?: string;
  colorKey?: string;
  /** Parent in the project outline — set when adding a sub-task. */
  parentId?: string;
  recurrence?: Recurrence;
}

export interface NewTransactionInput {
  title: string;
  amount: number;
  category: string;
  date?: LocalDate;
}

const Ctx = createContext<OrvanContext | null>(null);

export function OrvanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);

  /**
   * Mirrors `state` but is updated synchronously. Actions need to read the
   * current state and report the outcome back to the caller in the same tick —
   * a setState updater cannot do that, because React runs it later.
   */
  const stateRef = useRef(state);

  const apply = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const update = useCallback(
    (fn: (s: AppState) => AppState) => apply(fn(stateRef.current)),
    [apply],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Nothing stored means a brand-new browser: the demo build lands on a
      // populated account rather than on empty charts, the tester build on the
      // clean slate they are there to fill.
      const fresh = BLANK ? EMPTY_STATE : buildDemoState();
      const restored = raw ? ({ ...EMPTY_STATE, ...JSON.parse(raw) } as AppState) : fresh;
      stateRef.current = restored;
      setState(restored);
    } catch {
      // Corrupt or unavailable storage: fall back to a clean slate rather
      // than trapping the user on a broken screen.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota or private-mode failure is not worth interrupting the session.
    }
  }, [state, ready]);

  const addTask = useCallback(
    (input: NewTaskInput) => {
      update((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          {
            id: uid(),
            title: input.title.trim(),
            // Enforced here rather than in the form, so no other caller can
            // route around the rule that repeats pay the Medium rate.
            priority: input.recurrence ? RECURRING_PRIORITY : input.priority,
            dueDate: input.dueDate ?? today(),
            dueTime: input.dueTime,
            durationMin: input.dueTime ? input.durationMin : undefined,
            projectId: input.projectId,
            colorKey: input.colorKey,
            parentId: input.parentId,
            recurrence: input.recurrence,
            status: "open",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [update],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<Task, "id">>) => {
      update((s) => {
        const target = s.tasks.find((task) => task.id === id);
        if (!target) return s;

        const nextPatch = {
          ...patch,
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.recurrence ? { priority: RECURRING_PRIORITY } : {}),
        };

        /*
         * Content edits apply to the whole recurring series. The date remains
         * occurrence-specific: moving Tuesday's copy must not stack every copy
         * onto Tuesday.
         */
        const rootId = target.parentTaskId ?? target.id;
        const shared = { ...nextPatch };
        delete shared.dueDate;
        delete shared.status;
        delete shared.completedAt;
        delete shared.createdAt;
        delete shared.occurrenceDate;
        delete shared.parentTaskId;
        const belongsToSeries = (task: Task) =>
          task.id === rootId || task.parentTaskId === rootId;

        return {
          ...s,
          tasks: s.tasks.map((task) => {
            if (task.id === id) return { ...task, ...nextPatch };
            if ((target.recurrence || target.parentTaskId) && belongsToSeries(task)) {
              return { ...task, ...shared };
            }
            return task;
          }),
        };
      });
    },
    [update],
  );

  const ensureRecurringTasksThrough = useCallback(
    (date: LocalDate) => {
      update((s) => {
        const tasks = materializeRecurrences(s.tasks, date, uid, new Date().toISOString());
        return tasks === s.tasks ? s : { ...s, tasks };
      });
    },
    [update],
  );

  const completeTask = useCallback(
    (id: string): CompletionResult | null => {
      const s = stateRef.current;
      const task = s.tasks.find((t) => t.id === id);
      if (!task || task.status === "done") return null;

      const day = today();
      const now = new Date().toISOString();
      const award = awardForTaskCompletion(s.xpEvents, day, task.priority);
      const streakUpdate = registerActivity(s.streak, day);
      const levelBefore = levelFromTotalXp(totalXp(s.xpEvents)).level;

      const newEvents: XpEvent[] = [
        {
          id: uid(),
          source: "task",
          amount: award.xp,
          priority: task.priority,
          refId: task.id,
          date: day,
          createdAt: now,
        },
      ];

      if (streakUpdate.bonusXp > 0) {
        newEvents.push({
          id: uid(),
          source: "streak",
          amount: streakUpdate.bonusXp,
          date: day,
          createdAt: now,
        });
      }

      const xpEvents = [...s.xpEvents, ...newEvents];
      const levelAfter = levelFromTotalXp(totalXp(xpEvents)).level;
      const earned = award.xp + streakUpdate.bonusXp;

      apply({
        ...s,
        xpEvents,
        streak: streakUpdate.streak,
        // Coins track XP 1:1 on the way in, but are spent independently.
        profile: { ...s.profile, coinsBalance: s.profile.coinsBalance + earned },
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, status: "done" as const, completedAt: now } : t,
        ),
      });

      return {
        xp: award.xp,
        reason: award.reason,
        bonusXp: streakUpdate.bonusXp,
        leveledUpTo: levelAfter > levelBefore ? levelAfter : undefined,
      };
    },
    [apply],
  );

  /**
   * Un-checking restores the task but deliberately keeps the XpEvent. The
   * ledger is append-only, so check/uncheck cannot be used to re-roll an award.
   */
  const reopenTask = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, status: "open" as const, completedAt: undefined } : t,
        ),
      }));
    },
    [update],
  );

  /**
   * Sub-tasks are promoted rather than deleted with their parent. A row whose
   * `parentId` points at nothing is a row the outline can no longer draw, so
   * cascading silently would look identical to losing work.
   */
  const deleteTask = useCallback(
    (id: string) => {
      update((s) => {
        const target = s.tasks.find((task) => task.id === id);
        if (!target) return s;
        // Deleting a repeated row removes its series. Otherwise the next
        // calendar expansion would faithfully recreate the deleted occurrence.
        const rootId = target.parentTaskId ?? target.id;
        const recurring = Boolean(target.recurrence || target.parentTaskId);
        const removedIds = new Set(
          s.tasks
            .filter((task) =>
              recurring
                ? task.id === rootId || task.parentTaskId === rootId
                : task.id === id,
            )
            .map((task) => task.id),
        );

        return {
          ...s,
          tasks: s.tasks
            .filter((task) => !removedIds.has(task.id))
            .map((task) =>
              task.parentId && removedIds.has(task.parentId)
                ? { ...task, parentId: undefined }
                : task,
            ),
        };
      });
    },
    [update],
  );

  const addProject = useCallback(
    (name: string, color: string) => {
      const project: Project = {
        id: uid(),
        name: name.trim(),
        color,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      update((s) => ({ ...s, projects: [...s.projects, project] }));
    },
    [update],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Omit<Project, "id">>) => {
      update((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [update],
  );

  /** Tasks outlive their project — they lose the tag rather than disappearing. */
  const deleteProject = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.map((t) =>
          t.projectId === id ? { ...t, projectId: undefined } : t,
        ),
      }));
    },
    [update],
  );

  const addTransaction = useCallback(
    (input: NewTransactionInput) => {
      const tx: Transaction = {
        id: uid(),
        title: input.title.trim(),
        amount: input.amount,
        category: input.category,
        date: input.date ?? today(),
        createdAt: new Date().toISOString(),
      };
      update((s) => ({ ...s, transactions: [...s.transactions, tx] }));
    },
    [update],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
      }));
    },
    [update],
  );

  const setBudget = useCallback(
    (category: string, limit: number) => {
      update((s) => {
        const rest = s.budgets.filter((b) => b.category !== category);
        // A zero or negative ceiling means "no budget", not "a budget of nothing".
        const budgets: Budget[] = limit > 0 ? [...rest, { category, limit }] : rest;
        return { ...s, budgets };
      });
    },
    [update],
  );

  const addGoal = useCallback(
    (input: { title: string; area: GoalArea; targetDate?: LocalDate }) => {
      const goal: Goal = {
        id: uid(),
        title: input.title.trim(),
        area: input.area,
        targetDate: input.targetDate,
        progress: 0,
        createdAt: new Date().toISOString(),
      };
      update((s) => ({ ...s, goals: [...s.goals, goal] }));
    },
    [update],
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<Omit<Goal, "id">>) => {
      update((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }));
    },
    [update],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      update((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
    },
    [update],
  );

  const completeOnboarding = useCallback(
    (profileName: string, emoji: string) => {
      update((s) => ({
        ...s,
        onboarded: true,
        profile: {
          ...s.profile,
          displayName: profileName.trim() || "You",
          avatarEmoji: emoji,
        },
      }));
    },
    [update],
  );

  const resetAll = useCallback(() => apply(EMPTY_STATE), [apply]);

  const value = useMemo<OrvanContext>(
    () => ({
      state,
      ready,
      addTask,
      updateTask,
      ensureRecurringTasksThrough,
      completeTask,
      reopenTask,
      deleteTask,
      addProject,
      updateProject,
      deleteProject,
      addTransaction,
      deleteTransaction,
      setBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      completeOnboarding,
      resetAll,
    }),
    [
      state,
      ready,
      addTask,
      updateTask,
      ensureRecurringTasksThrough,
      completeTask,
      reopenTask,
      deleteTask,
      addProject,
      updateProject,
      deleteProject,
      addTransaction,
      deleteTransaction,
      setBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      completeOnboarding,
      resetAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrvan(): OrvanContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOrvan must be used inside OrvanProvider");
  return ctx;
}

/** Derived view of the numbers the header and Growth page both need. */
export function useStats() {
  const { state } = useOrvan();
  return useMemo(() => {
    const xp = totalXp(state.xpEvents);
    return {
      totalXp: xp,
      ...levelFromTotalXp(xp),
      coins: state.profile.coinsBalance,
      streak: state.streak,
    };
  }, [state.xpEvents, state.profile.coinsBalance, state.streak]);
}

export function sortTasks(tasks: Task[]): Task[] {
  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority]);
}
