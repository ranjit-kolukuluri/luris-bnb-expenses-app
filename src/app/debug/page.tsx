"use client";

import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import { getRecurringOps } from "@/lib/monthly-ops";

export default function DebugPage() {
  const { transactions, property } = useData();

  // Get all recurring expenses
  const recurringExpenses = transactions
    .filter((t) => t.type === "expense" && t.cadence === "recurring")
    .sort((a, b) => a.title.localeCompare(b.title));

  // Get recurring ops breakdown
  const recurringOps = getRecurringOps(transactions, property.monthly_mortgage_total);

  // Get last 20 expense transactions sorted by occurred_on
  const recentExpenses = transactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
    .slice(0, 20);

  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header>
        <h1 className="display text-3xl font-semibold">Debug: Transactions</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Recurring expenses breakdown and recent transactions
        </p>
      </header>

      {/* Recurring expenses breakdown */}
      <section className="panel mt-4 p-4">
        <h2 className="text-lg font-semibold">Recurring Expenses (Break-even)</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          These are summed to calculate your break-even number
        </p>
        
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between rounded bg-[var(--surface-2)] p-2">
            <span className="font-medium">Mortgage:</span>
            <span className="font-semibold tabular-nums">{formatCurrency(recurringOps.mortgage)}</span>
          </div>
          <div className="flex justify-between rounded bg-[var(--surface-2)] p-2">
            <span className="font-medium">Utilities:</span>
            <span className="font-semibold tabular-nums">{formatCurrency(recurringOps.utilities)}</span>
          </div>
          <div className="flex justify-between rounded bg-[var(--surface-2)] p-2">
            <span className="font-medium">Water:</span>
            <span className="font-semibold tabular-nums">{formatCurrency(recurringOps.water)}</span>
          </div>
          <div className="flex justify-between rounded bg-[var(--surface-2)] p-2">
            <span className="font-medium">Property Management:</span>
            <span className="font-semibold tabular-nums">{formatCurrency(recurringOps.management)}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-2 text-base">
            <span className="font-bold">Total Break-even:</span>
            <span className="font-bold tabular-nums">
              {formatCurrency(
                recurringOps.mortgage +
                  recurringOps.utilities +
                  recurringOps.water +
                  recurringOps.management
              )}
            </span>
          </div>
        </div>
      </section>

      {/* All recurring transactions */}
      <section className="panel mt-4 p-4">
        <h2 className="text-lg font-semibold">All Recurring Transactions</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Count: {recurringExpenses.length} transactions
        </p>
        
        <div className="mt-3 space-y-2">
          {recurringExpenses.map((tx) => (
            <div
              key={tx.id}
              className="rounded border border-[var(--line)] p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold">{tx.title}</div>
                  {tx.vendor && (
                    <div className="text-xs text-[var(--ink-muted)]">
                      Vendor: {tx.vendor}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-[var(--ink-muted)]">
                    ID: {tx.id}
                  </div>
                  {tx.expense_group && (
                    <div className="mt-1">
                      <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {tx.expense_group}
                        {tx.expense_subgroup && ` → ${tx.expense_subgroup}`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right font-semibold tabular-nums">
                  {formatCurrency(Number(tx.amount))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <h2 className="mt-6 text-xl font-semibold">Recent Expenses (Last 20)</h2>

      <div className="mt-4 space-y-2">
        {recentExpenses.map((tx) => (
          <div
            key={tx.id}
            className="panel p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold">{tx.title}</div>
                {tx.vendor && (
                  <div className="text-xs text-[var(--ink-muted)]">
                    Vendor: {tx.vendor}
                  </div>
                )}
                <div className="mt-1 text-xs">
                  <span className="text-[var(--ink-muted)]">Date: </span>
                  {tx.occurred_on}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      tx.expense_group
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {tx.expense_group ? (
                      <>
                        Group: {tx.expense_group}
                        {tx.expense_subgroup && ` → ${tx.expense_subgroup}`}
                      </>
                    ) : (
                      "No expense_group (will show as ops cost)"
                    )}
                  </span>
                </div>
              </div>
              <div className="text-right font-semibold tabular-nums">
                {formatCurrency(Number(tx.amount))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel mt-4 p-4 text-sm">
        <h2 className="font-semibold">Legend</h2>
        <ul className="mt-2 space-y-1 text-xs text-[var(--ink-muted)]">
          <li>
            <span className="inline-block w-24 rounded bg-green-100 px-2 py-0.5 text-green-800">
              Green
            </span>{" "}
            = Has expense_group (contractor_fees, materials, interior_design, property_management)
          </li>
          <li>
            <span className="inline-block w-24 rounded bg-red-100 px-2 py-0.5 text-red-800">
              Red
            </span>{" "}
            = No expense_group (counted as operating expense, not renovation capital)
          </li>
        </ul>
      </div>
    </main>
  );
}
