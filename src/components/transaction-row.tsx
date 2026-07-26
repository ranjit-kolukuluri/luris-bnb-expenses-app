"use client";

import { formatCurrency } from "@/lib/calculations";
import type { Transaction, Unit } from "@/lib/types";
import { cn } from "@/lib/cn";

export function TransactionRow({
  tx,
  units,
  onEdit,
}: {
  tx: Transaction;
  units: Unit[];
  onEdit?: (tx: Transaction) => void;
}) {
  const unit = units.find((u) => u.id === tx.unit_id);
  const isIncome = tx.type === "income";

  return (
    <button
      type="button"
      onClick={() => onEdit?.(tx)}
      className="flex w-full items-start justify-between gap-3 border-b border-[var(--line)] py-3 text-left last:border-b-0"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{tx.title}</p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          {tx.occurred_on}
          {unit ? ` · ${unit.code}` : ""}
          {tx.payment_account ? ` · ${tx.payment_account}` : ""}
          {tx.cadence === "recurring" ? " · recurring" : ""}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          isIncome ? "text-[var(--good)]" : "text-[var(--ink)]"
        )}
      >
        {isIncome ? "+" : "−"}
        {formatCurrency(Math.abs(Number(tx.amount)))}
      </p>
    </button>
  );
}
