export type Priority = "low" | "medium" | "high";

export type TaskStatus = "open" | "done";

/** YYYY-MM-DD in the user's local timezone. */
export type LocalDate = string;

export interface Task {
  id: string;
  title: string;
  notes?: string;
  projectId?: string;
  /** Key into PALETTE — the colour category the row and event are tinted with. */
  colorKey?: string;
  dueDate?: LocalDate;
  dueTime?: string;
  /** Minutes the task occupies on the calendar. Only meaningful with dueTime. */
  durationMin?: number;
  priority: Priority;
  status: TaskStatus;
  completedAt?: string;
  createdAt: string;
  /** Parent in the project outline. A task with one is a sub-task. */
  parentId?: string;
  /** Set on generated occurrences of a recurring task. */
  parentTaskId?: string;
  occurrenceDate?: LocalDate;
  recurrence?: Recurrence;
}

export type Recurrence =
  | { kind: "daily" }
  | { kind: "weekdays" }
  | { kind: "weekly"; weekday: number };

export interface Project {
  id: string;
  name: string;
  color: string;
  goalTag?: string;
  targetDate?: LocalDate;
  status: "active" | "archived";
  createdAt: string;
}

export type XpSource = "task" | "quest" | "streak" | "bonus";

/**
 * Append-only ledger. `user.xpTotal`, weekly league standings and the daily
 * caps are all derived from this — never from a separate mutable counter.
 */
export interface XpEvent {
  id: string;
  source: XpSource;
  amount: number;
  /** Present when source is "task" — needed to enforce per-priority limits. */
  priority?: Priority;
  refId?: string;
  date: LocalDate;
  createdAt: string;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate?: LocalDate;
  freezesOwned: number;
}

export interface Profile {
  displayName: string;
  avatarEmoji: string;
  coinsBalance: number;
  createdAt: string;
}

/**
 * Finance is entered by hand — there is no bank connection, and pre-filling it
 * would mean the first chart a user sees is not theirs.
 */
export interface Transaction {
  id: string;
  title: string;
  /** Positive is income, negative is spending. One field, so totals just add. */
  amount: number;
  category: string;
  date: LocalDate;
  createdAt: string;
}

/** A budget ceiling per category, per month. */
export interface Budget {
  category: string;
  limit: number;
}

/** The long-horizon things the dashboards are supposed to be in service of. */
export interface Goal {
  id: string;
  title: string;
  area: GoalArea;
  targetDate?: LocalDate;
  /** 0–100, moved by hand. Auto-linking to tasks is a later pass. */
  progress: number;
  createdAt: string;
}

export type GoalArea = "work" | "health" | "money" | "learning" | "life";

export interface AppState {
  profile: Profile;
  tasks: Task[];
  projects: Project[];
  xpEvents: XpEvent[];
  streak: Streak;
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  onboarded: boolean;
}
