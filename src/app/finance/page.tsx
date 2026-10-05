"use client";

import { useMemo, useState } from "react";

import { DatePicker, relativeLabel } from "@/components/DateField";
import { TopBar } from "@/components/TopBar";
import { Bar, Card } from "@/components/ui";
import { today } from "@/lib/domain/dates";
import {
  CATEGORIES,
  CURRENCY,
  categoryIcon,
  categoryTotals,
  compact,
  full,
  summarise,
  weekSpending,
} from "@/lib/domain/finance";
import { useOrvan } from "@/lib/store/store";

export default function FinancePage() {
  const { state, ready, addTransaction, deleteTransaction, setBudget } = useOrvan();
  const [formOpen, setFormOpen] = useState(false);

  const day = today();
  const tx = state.transactions;

  const summary = useMemo(() => summarise(tx, day), [tx, day]);
  const week = useMemo(() => weekSpending(tx, day), [tx, day]);
  const categories = useMemo(
    () => categoryTotals(tx, state.budgets, day),
    [tx, state.budgets, day],
  );

  const recent = useMemo(
    () => [...tx].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12),
    [tx],
  );

  const [focused, setFocused] = useState<string | null>(null);
  const max = Math.max(...week.map((d) => d.spent), 1);
  const shown = week.find((d) => d.label === focused);

  if (!ready) return <div className="flex-1 animate-pulse bg-bg" aria-label="Loading" />;

  const empty = tx.length === 0;

  return (
    <>
      <TopBar
        title="Finance"
        subtitle={
          empty ? "Nothing logged yet" : `${tx.length} ${tx.length === 1 ? "entry" : "entries"}`
        }
        action={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-on-accent transition-opacity hover:opacity-90 sm:px-3.5"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ Add entry</span>
          </button>
        }
      />

      {empty ? (
        <EmptyState onStart={() => setFormOpen(true)} />
      ) : (
        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-6 xl:grid-cols-3">
          {/*
            Spending more than you logged as income is the normal state of a
            half-filled ledger, so the card flips its framing rather than
            printing a negative "left to spend" — which reads as a broken sum.
          */}
          <section
            className={`relative overflow-hidden rounded-2xl p-5 sm:col-span-2 xl:col-span-1 ${
              summary.net < 0
                ? "border border-p-high/40 bg-p-high/10"
                : "bg-accent text-on-accent"
            }`}
          >
            <div
              className="pointer-events-none absolute -end-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl"
              aria-hidden="true"
            />
            <p
              className={`relative text-[11px] font-medium uppercase tracking-widest ${
                summary.net < 0 ? "text-p-high" : "text-on-accent/70"
              }`}
            >
              {summary.net < 0 ? "Over budget this month" : "Left this month"}
            </p>
            <p className="relative mt-3 text-3xl font-semibold tabular-nums sm:text-4xl">
              {compact(Math.abs(summary.net))}
              <span className="ms-1 text-xl">{CURRENCY}</span>
            </p>
            <p
              className={`relative mt-2 text-xs ${
                summary.net < 0 ? "text-ink-dim" : "text-on-accent/70"
              }`}
            >
              {summary.net < 0
                ? `${full(summary.spent)} out against ${full(summary.income)} in`
                : `${full(Math.round(summary.net / summary.daysLeft))} ${CURRENCY} a day for the ${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"} left`}
            </p>
          </section>

          <Stat label="Income this month" value={summary.income} tone="in" />
          <Stat label="Spent this month" value={summary.spent} tone="out" />

          <Card
            title="This week"
            className="sm:col-span-2"
            aside={<span className="text-[11px] text-ink-faint">Tap a bar</span>}
          >
            <div className="flex h-48 items-end gap-2 sm:h-56 sm:gap-3">
              {week.map((d, i) => {
                const active = d.label === focused;
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setFocused(active ? null : d.label)}
                    className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  >
                    {active && (
                      <span className="animate-pop-in rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-bg tabular-nums">
                        {compact(d.spent)}
                      </span>
                    )}
                    <span
                      className={`animate-grow-y w-full rounded-xl transition-colors ${
                        active ? "bg-accent" : "bg-surface-3 group-hover:bg-surface-3/70"
                      }`}
                      style={{
                        // A floor, so a zero-spend day is still a target you can
                        // hit rather than an invisible sliver.
                        height: `${Math.max(2, (d.spent / max) * 100)}%`,
                        animationDelay: `${i * 45}ms`,
                      }}
                    />
                    <span
                      className={`text-[11px] ${
                        active ? "font-medium text-accent-soft" : "text-ink-faint"
                      }`}
                    >
                      {d.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-dim">
              {shown ? (
                <>
                  {relativeLabel(shown.date, day)}:{" "}
                  <span className="text-ink tabular-nums">{full(shown.spent)}</span> {CURRENCY}
                </>
              ) : (
                <>
                  Week total:{" "}
                  <span className="text-ink tabular-nums">
                    {full(week.reduce((s, d) => s + d.spent, 0))}
                  </span>{" "}
                  {CURRENCY}
                </>
              )}
            </p>
          </Card>

          <Card
            title="Categories"
            className="sm:col-span-2 xl:col-span-1"
            aside={<span className="text-[11px] text-ink-faint">this month</span>}
          >
            {categories.length === 0 ? (
              <p className="text-xs text-ink-faint">No spending logged this month yet.</p>
            ) : (
              <ul className="flex flex-col gap-3.5">
                {categories.map((c) => (
                  <li key={c.name} className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm">
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{c.name}</span>
                      <span className="block text-[11px] text-ink-faint tabular-nums">
                        {compact(c.spent)}
                        {c.budget ? ` / ${compact(c.budget)}` : ""}
                      </span>
                    </span>
                    <span className="w-24 shrink-0">
                      <Bar
                        pct={c.budget ? c.spent / c.budget : c.spent / (categories[0]?.spent || 1)}
                        color={c.budget && c.spent > c.budget ? "bg-p-high" : "bg-accent"}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Transactions"
            className="sm:col-span-2"
            aside={<span className="text-[11px] text-ink-faint">{tx.length} total</span>}
          >
            <ul className="flex flex-col">
              {recent.map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 border-b border-line/60 py-3 last:border-0"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm">
                    {categoryIcon(t.category)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{t.title}</span>
                    <span className="block text-[11px] text-ink-faint">{t.category}</span>
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">
                    {relativeLabel(t.date, day)}
                  </span>
                  <span
                    className={`shrink-0 text-end text-[13px] tabular-nums sm:w-32 ${
                      t.amount > 0 ? "text-accent-soft" : "text-ink"
                    }`}
                  >
                    {t.amount > 0 ? "+" : "−"}
                    {full(Math.abs(t.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTransaction(t.id)}
                    aria-label={`Delete ${t.title}`}
                    className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-p-high focus:opacity-100 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-4 sm:col-span-2 sm:gap-5 xl:col-span-1">
            <Card title="Budgets" aside={<span className="text-[11px] text-ink-faint">monthly</span>}>
              {categories.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  Log some spending and the categories will show up here to cap.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {categories.slice(0, 4).map((c) => (
                    <li key={c.name}>
                      <p className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-ink-dim">{c.name}</span>
                        <BudgetInput
                          value={c.budget}
                          onCommit={(limit) => setBudget(c.name, limit)}
                        />
                      </p>
                      <Bar
                        pct={c.budget ? c.spent / c.budget : 0}
                        color={c.budget && c.spent > c.budget ? "bg-p-high" : "bg-accent"}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Finance quests">
              <ul className="flex flex-col gap-3">
                {(
                  [
                    ["Log today's spending", 10],
                    ["Set a budget on your top category", 50],
                  ] as const
                ).map(([label, xp]) => (
                  <li key={label} className="flex items-center gap-2.5 text-[13px] text-ink-dim">
                    <span
                      className="size-4 shrink-0 rounded-full border border-line"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="shrink-0 text-[11px] text-accent-soft tabular-nums">
                      +{xp}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
                Money habits pay XP like any other task — that is the whole reason Finance sits
                inside Orvan instead of in a separate app.
              </p>
            </Card>
          </div>
        </div>
      )}

      {formOpen && (
        <EntrySheet onClose={() => setFormOpen(false)} onSubmit={addTransaction} />
      )}
    </>
  );
}

/* ------------------------------- empty state ------------------------------ */

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-dashed border-line p-6 text-center sm:p-10">
        <p className="text-4xl" aria-hidden="true">
          ◎
        </p>
        <h2 className="mt-4 text-lg font-semibold">Start with one entry</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-dim">
          Nothing here is pre-filled. The charts, the budgets and the safe-to-spend number are all
          built from what you type in — so the first one you add is the first one that counts.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Add your first entry
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- add sheet ------------------------------- */

function EntrySheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; amount: number; category: string; date: string }) => void;
}) {
  const [kind, setKind] = useState<"out" | "in">("out");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [date, setDate] = useState(today());

  const value = Number(amount.replace(/[^\d.]/g, ""));
  const valid = title.trim().length > 0 && value > 0;

  function submit() {
    if (!valid) return;
    onSubmit({
      title,
      // One signed field rather than a separate type flag: totals then just add.
      amount: kind === "in" ? value : -value,
      category: kind === "in" ? "Income" : category,
      date,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-shade/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="animate-pop-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add entry"
      >
        <div className="mb-4 flex rounded-lg border border-line p-0.5">
          {(
            [
              ["out", "Spent"],
              ["in", "Earned"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 rounded-[6px] py-1.5 text-xs transition-colors ${
                kind === k ? "bg-accent font-medium text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder={kind === "in" ? "Where from?" : "What on?"}
          className="w-full rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:ring-1 focus:ring-accent"
        />

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 focus-within:ring-1 focus-within:ring-accent">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            inputMode="numeric"
            placeholder="0"
            aria-label="Amount"
            className="min-w-0 flex-1 bg-transparent text-lg tabular-nums outline-none placeholder:text-ink-faint"
          />
          <span className="shrink-0 text-sm text-ink-faint">{CURRENCY}</span>
        </div>

        {kind === "out" && (
          <>
            <p className="mb-2 mt-4 text-xs text-ink-dim">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter((c) => !c.income).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                    category === c.name
                      ? "bg-accent text-on-accent"
                      : "bg-surface-2 text-ink-dim hover:text-ink"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mb-2 mt-4 text-xs text-ink-dim">Date</p>
        <div className="w-40">
          <DatePicker value={date} onChange={setDate} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-40"
          >
            Add entry
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Stat({ label, value, tone }: { label: string; value: number; tone: "in" | "out" }) {
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums">
        {compact(value)}
        <span className="ms-1 text-xl text-ink-dim">{CURRENCY}</span>
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        {tone === "in" ? "Everything logged as earned" : "Everything logged as spent"}
      </p>
    </Card>
  );
}

function BudgetInput({
  value,
  onCommit,
}: {
  value?: number;
  onCommit: (limit: number) => void;
}) {
  const [draft, setDraft] = useState(value ? String(value) : "");

  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(Number(draft.replace(/[^\d]/g, "")) || 0)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        inputMode="numeric"
        placeholder="set cap"
        aria-label="Monthly budget"
        className="w-20 rounded-md bg-surface-2 px-2 py-0.5 text-end text-[11px] tabular-nums outline-none placeholder:text-ink-faint/70 focus:ring-1 focus:ring-accent"
      />
    </span>
  );
}
