"use client";

import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";

export default function DebugPage() {
  const { transactions } = useData();

  // Get last 20 expense transactions sorted by occurred_on
  const recentExpenses = transactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
    .slice(0, 20);

  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header>
        <h1 className="display text-3xl font-semibold">Debug: Recent Expenses</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Shows the last 20 expenses with their expense_group values
        </p>
      </header>

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
