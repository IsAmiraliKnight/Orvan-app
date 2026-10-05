import { addDays, startOfWeek, today } from "./dates";
import type { Budget, LocalDate, Transaction } from "./types";

export const CURRENCY = "T";

/**
 * The categories a new account starts with. They are labels, not records: a
 * user typing their first expense should not have to create a taxonomy first.
 */
export const CATEGORIES: ReadonlyArray<{ name: string; icon: string; income?: boolean }> = [
  { name: "Income", icon: "💼", income: true },
  { name: "Groceries", icon: "🛒" },
  { name: "Transport", icon: "🚌" },
  { name: "Eating out", icon: "🍜" },
  { name: "Bills", icon: "💡" },
  { name: "Learning", icon: "📚" },
  { name: "Health", icon: "🩺" },
  { name: "Other", icon: "•" },
];

export function categoryIcon(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.icon ?? "•";
}

/** 12.4M — short enough to sit inside a card without wrapping. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

export function full(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function sameMonth(date: LocalDate, ref: LocalDate): boolean {
  return date.slice(0, 7) === ref.slice(0, 7);
}

export interface FinanceSummary {
  income: number;
  spent: number;
  net: number;
  /** What is left this month, spread over the days that remain. */
  safeToSpend: number;
  daysLeft: number;
}

export function summarise(
  transactions: Transaction[],
  ref: LocalDate = today(),
): FinanceSummary {
  const month = transactions.filter((t) => sameMonth(t.date, ref));
  const income = month.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = month.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const net = income - spent;

  const d = new Date(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)), 0).getDate();
  const daysLeft = Math.max(1, d - Number(ref.slice(8, 10)) + 1);

  return { income, spent, net, safeToSpend: Math.max(0, net), daysLeft };
}

export interface DayPoint {
  label: string;
  date: LocalDate;
  spent: number;
}

/** Monday-anchored, so the bars line up with the rest of the app's weeks. */
export function weekSpending(
  transactions: Transaction[],
  ref: LocalDate = today(),
): DayPoint[] {
  const start = startOfWeek(ref);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return labels.map((label, i) => {
    const date = addDays(start, i);
    const spent = transactions
      .filter((t) => t.date === date && t.amount < 0)
      .reduce((s, t) => s - t.amount, 0);
    return { label, date, spent };
  });
}

export interface CategoryTotal {
  name: string;
  icon: string;
  spent: number;
  budget?: number;
}

export function categoryTotals(
  transactions: Transaction[],
  budgets: Budget[],
  ref: LocalDate = today(),
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0 || !sameMonth(t.date, ref)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) - t.amount);
  }

  return [...totals.entries()]
    .map(([name, spent]) => ({
      name,
      icon: categoryIcon(name),
      spent,
      budget: budgets.find((b) => b.category === name)?.limit,
    }))
    .sort((a, b) => b.spent - a.spent);
}
