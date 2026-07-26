"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TransactionFormModal } from "@/components/transaction-form-modal";
import { TransactionRow } from "@/components/transaction-row";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import type { Transaction } from "@/lib/types";

export default function IncomePage() {
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
  const [unitFilter, setUnitFilter] = useState<string>("all");

  const income = useMemo(() => {
    return transactions
      .filter((t) => t.type === "income")
      .filter((t) => (unitFilter === "all" ? true : t.unit_id === unitFilter))
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  }, [transactions, unitFilter]);

  const byUnit = useMemo(() => {
    return units.map((u) => ({
      unit: u,
      total: income
        .filter((t) => t.unit_id === u.id)
        .reduce((s, t) => s + Number(t.amount), 0),
    }));
  }, [units, income]);

  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header className="animate-rise flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
            Inflows
          </p>
          <h1 className="display text-3xl font-semibold">Income</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            This month {formatCurrency(metrics.monthIncome)} · need{" "}
            {formatCurrency(metrics.breakEven)} to break even
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

      <section className="stagger mt-4 grid grid-cols-2 gap-2">
        {byUnit.map(({ unit, total }) => (
          <button
            key={unit.id}
            type="button"
            onClick={() => setUnitFilter(unitFilter === unit.id ? "all" : unit.id)}
            className={`panel p-3 text-left ${unitFilter === unit.id ? "ring-2 ring-[var(--accent)]" : ""}`}
          >
            <p className="text-xs font-semibold text-[var(--accent)]">{unit.code}</p>
            <p className="display text-lg font-semibold">{formatCurrency(total)}</p>
            <p className="text-[0.7rem] text-[var(--ink-muted)]">{unit.rental_model.replace("_", " ")}</p>
          </button>
        ))}
      </section>

      <section className="panel animate-fade mt-4 px-4">
        {income.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--ink-muted)]">
            No rent or Airbnb income logged yet. Add payouts from BlueVine / BoA.
          </p>
        ) : (
          income.map((tx) => (
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
        defaultType="income"
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
