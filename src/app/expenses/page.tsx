"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const [selectedPayee, setSelectedPayee] = useState<string | null>(null);

  const expenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .filter((t) => (filter === "all" ? true : t.cadence === filter))
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  }, [transactions, filter]);

  const payeeRows = useMemo(() => {
    const map = new Map<
      string,
      { payee: string; total: number; txCount: number; lastDate: string }
    >();
    for (const t of expenses) {
      const payee =
        t.vendor?.trim() ||
        t.payment_account?.trim() ||
        t.title.split("—")[0]?.trim() ||
        "Unknown";
      const row = map.get(payee) || {
        payee,
        total: 0,
        txCount: 0,
        lastDate: t.occurred_on,
      };
      row.total += Number(t.amount);
      row.txCount += 1;
      if (t.occurred_on > row.lastDate) row.lastDate = t.occurred_on;
      map.set(payee, row);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const selectedPayeeValue =
    selectedPayee && payeeRows.some((p) => p.payee === selectedPayee)
      ? selectedPayee
      : payeeRows[0]?.payee ?? null;

  const selectedPayeeTotal =
    payeeRows.find((r) => r.payee === selectedPayeeValue)?.total ?? 0;

  const payeeTrend = useMemo(() => {
    if (!selectedPayeeValue) return [];
    const monthMap = new Map<string, number>();
    for (const t of expenses) {
      const payee =
        t.vendor?.trim() ||
        t.payment_account?.trim() ||
        t.title.split("—")[0]?.trim() ||
        "Unknown";
      if (payee !== selectedPayeeValue) continue;
      const month = (t.applies_on || t.occurred_on).slice(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + Number(t.amount));
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month,
        label: new Date(`${month}-01T12:00:00`).toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        amount: Number(amount.toFixed(2)),
      }));
  }, [expenses, selectedPayeeValue]);

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

      <section className="panel animate-fade mt-4 p-4">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="section-kicker">Spend Intelligence</p>
            <h2 className="display text-xl font-semibold">By payee / vendor</h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--ink-muted)]">Total expenses</p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(expenses.reduce((s, t) => s + Number(t.amount), 0))}
            </p>
          </div>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {payeeRows.map((row) => (
            <button
              key={row.payee}
              type="button"
              onClick={() => setSelectedPayee(row.payee)}
              className={`w-full rounded-xl border px-3 py-2 text-left ${
                selectedPayeeValue === row.payee
                  ? "border-[var(--accent)] bg-[rgba(31,122,140,0.08)]"
                  : "border-[var(--line)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{row.payee}</p>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatCurrency(row.total)}
                </p>
              </div>
              <p className="mt-0.5 text-[0.72rem] text-[var(--ink-muted)]">
                {row.txCount} payments · latest {row.lastDate}
              </p>
            </button>
          ))}
        </div>

        {selectedPayeeValue ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] p-3">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-[var(--ink-muted)]">Historical trend</p>
                <p className="font-semibold">{selectedPayeeValue}</p>
              </div>
              <p className="font-semibold tabular-nums">
                {formatCurrency(selectedPayeeTotal)}
              </p>
            </div>
            {payeeTrend.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                No monthly history available for this payee yet.
              </p>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payeeTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(21,34,28,0.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#5c677a" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    <Bar
                      dataKey="amount"
                      name="Spend"
                      fill="#1f7a8c"
                      radius={[7, 7, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <TransactionFormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={editing}
        categories={categories}
        units={units}
        defaultType="expense"
        onSave={async (data) => {
          try {
            if (data.id) {
              const { id, ...rest } = data;
              await updateTransaction(id, rest);
            } else {
              const { id: _id, ...rest } = data;
              await addTransaction(rest);
            }
          } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to save expense");
            return;
          }
        }}
        onDelete={deleteTransaction}
      />
    </main>
  );
}
