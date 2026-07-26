"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TransactionFormModal } from "@/components/transaction-form-modal";
import { TransactionRow } from "@/components/transaction-row";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import type { Transaction } from "@/lib/types";

export default function ExpensesPage() {
  const {
    transactions,
    units,
    categories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    metrics,
  } = useData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<"all" | "one_time" | "recurring">("all");

  const expenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .filter((t) => (filter === "all" ? true : t.cadence === filter))
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  }, [transactions, filter]);

  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header className="animate-rise flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
            Outflows
          </p>
          <h1 className="display text-3xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Fixed monthly {formatCurrency(metrics.monthlyFixedCost)} · invested{" "}
            {formatCurrency(metrics.totalInvested)}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary flex items-center gap-1 px-3"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={18} />
          Add
        </button>
      </header>

      <div className="mt-4 flex gap-2">
        {(["all", "one_time", "recurring"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`pill ${filter === f ? "!bg-[var(--accent)] !text-white" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "one_time" ? "One-time" : "Recurring"}
          </button>
        ))}
      </div>

      <section className="panel animate-fade mt-4 px-4">
        {expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--ink-muted)]">No expenses yet.</p>
        ) : (
          expenses.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              units={units}
              onEdit={(t) => {
                setEditing(t);
                setOpen(true);
              }}
            />
          ))
        )}
      </section>

      <TransactionFormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={editing}
        categories={categories}
        units={units}
        defaultType="expense"
        onSave={(data) => {
          if (data.id) {
            const { id, ...rest } = data;
            updateTransaction(id, rest);
          } else {
            const { id: _id, ...rest } = data;
            addTransaction(rest);
          }
        }}
        onDelete={deleteTransaction}
      />
    </main>
  );
}
