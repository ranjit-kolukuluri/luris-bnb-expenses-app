"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/calculations";
import { getRecurringOps } from "@/lib/monthly-ops";
import type { Transaction } from "@/lib/types";

interface BreakevenBreakdownProps {
  transactions: Transaction[];
  mortgageFallback: number;
}

export function BreakevenBreakdown({
  transactions,
  mortgageFallback,
}: BreakevenBreakdownProps) {
  const breakdown = useMemo(() => {
    const recurring = getRecurringOps(transactions, mortgageFallback);
    const total =
      recurring.mortgage +
      recurring.utilities +
      recurring.water +
      recurring.management;

    return {
      items: [
        {
          label: "Mortgage",
          amount: recurring.mortgage,
          description: "Principal + interest + insurance + taxes",
        },
        {
          label: "Utilities",
          amount: recurring.utilities,
          description: "PSE&G / recurring utility costs",
        },
        {
          label: "Water",
          amount: recurring.water,
          description: "Veolia / recurring water costs",
        },
        {
          label: "Property management",
          amount: recurring.management,
          description: "Recurring management fees",
        },
      ].filter((item) => item.amount > 0),
      total,
    };
  }, [transactions, mortgageFallback]);

  return (
    <div className="panel animate-fade mt-4 p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="section-kicker">Fixed costs</p>
          <h2 className="display text-xl font-semibold">Break-even breakdown</h2>
        </div>
        <span className="pill">{formatCurrency(breakdown.total)}</span>
      </div>
      <p className="mb-4 text-xs text-[var(--ink-muted)]">
        Your recurring monthly expenses. This is the minimum you need each month to break even.
      </p>

      <div className="space-y-3">
        {breakdown.items.map((item) => {
          const pct = breakdown.total > 0 ? Math.round((item.amount / breakdown.total) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-xs text-[var(--ink-muted)]">{item.description}</div>
                </div>
                <span className="ml-3 tabular-nums font-semibold">
                  {formatCurrency(item.amount)}
                  <span className="ml-1.5 text-xs font-normal text-[var(--ink-muted)]">
                    {pct}%
                  </span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1f7a8c] to-[#52b1c9] transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--surface-2)] px-3 py-3 text-sm">
        <p className="font-semibold text-[var(--ink)]">
          Why is this different from monthly ops cost?
        </p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Break-even shows only <strong>recurring fixed costs</strong>. Monthly ops cost includes
          these fixed costs PLUS any <strong>one-time operating expenses</strong> for that month
          (like repairs, maintenance, etc.).
        </p>
      </div>
    </div>
  );
}
