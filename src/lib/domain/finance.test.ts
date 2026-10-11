import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, monthGridDays, monthDays } from "./dates";
import { budgetsForMonth, categoryTotals, monthTransactions, monthSpending, summarise } from "./finance";
import type { Budget, Transaction } from "./types";

const tx: Transaction[] = [
  { id: "income", title: "September salary", amount: 1000, category: "Income", date: "2026-09-01", createdAt: "2026-09-01T09:00:00Z" },
  { id: "expense", title: "September shopping", amount: -250, category: "Groceries", date: "2026-09-30", createdAt: "2026-09-30T09:00:00Z" },
  { id: "october", title: "October shopping", amount: -50, category: "Groceries", date: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" },
];
const budgets: Budget[] = [{ category: "Groceries", limit: 300, month: "2026-09" }, { category: "Groceries", limit: 100, month: "2026-10" }];

test("previous months retain their own transactions and totals", () => {
  assert.equal(summarise(tx, "2026-09-01").net, 750);
  assert.equal(summarise(tx, "2026-10-01").net, -50);
  assert.deepEqual(monthTransactions(tx, "2026-09-01").map((t) => t.id), ["income", "expense"]);
  assert.equal(tx.length, 3);
});

test("budgets and category totals use only the selected month's cap", () => {
  assert.equal(budgetsForMonth(budgets, "2026-09-01")[0].limit, 300);
  assert.equal(categoryTotals(tx, budgets, "2026-09-01")[0].budget, 300);
  assert.equal(categoryTotals(tx, budgets, "2026-10-01")[0].budget, 100);
  assert.equal(categoryTotals(tx, budgets, "2026-08-01").length, 0);
});

test("monthly spending includes the last day and excludes adjoining months", () => {
  const points = monthSpending(tx, "2026-09-01");
  assert.equal(points.length, 30);
  assert.equal(points.at(-1)?.spent, 250);
  assert.equal(points.reduce((sum, p) => sum + p.spent, 0), 250);
});

test("month navigation handles year boundaries and leap-year February", () => {
  assert.equal(addMonths("2026-01-31", -1), "2025-12-01");
  assert.equal(addMonths("2026-12-31", 1), "2027-01-01");
  assert.equal(monthDays("2028-02-01").length, 29);
});

test("monthly calendar grids contain complete weeks and every date", () => {
  const grid = monthGridDays("2026-03-01");
  assert.equal(grid[0], "2026-02-23");
  assert.equal(grid.at(-1), "2026-04-05");
  assert.equal(grid.length, 42);
  assert.equal(monthDays("2026-03-01").every((date) => grid.includes(date)), true);
});
