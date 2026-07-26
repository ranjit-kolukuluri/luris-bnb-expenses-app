"use client";

import { useMemo } from "react";
import {
  computePropertyMgmtTotal,
  computeRenoBreakdown,
  formatCurrency,
} from "@/lib/calculations";
import type { Transaction } from "@/lib/types";

export function RenoBreakdownPanel({ transactions }: { transactions: Transaction[] }) {
  const { total, groups } = useMemo(
    () => computeRenoBreakdown(transactions),
    [transactions]
  );
  const mgmt = useMemo(
    () => computePropertyMgmtTotal(transactions),
    [transactions]
  );

  return (
    <section className="panel animate-fade mt-4 p-4">
      <div className="mb-1 flex items-end justify-between gap-2">
        <div>
          <p className="section-kicker">Renovation</p>
          <h2 className="display text-xl font-semibold">Spend by type</h2>
        </div>
        <span className="pill">{formatCurrency(total)}</span>
      </div>
      <p className="mb-4 text-xs text-[var(--ink-muted)]">
        Contractor + materials (incl. Best Buy) + Lulu design. Materials split 60/20/20 →
        1R/1L/2R.
      </p>

      <div className="space-y-4">
        {groups.map((g) => {
          const pct = total > 0 ? Math.round((g.amount / total) * 100) : 0;
          return (
            <div key={g.group}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{g.label}</span>
                <span className="tabular-nums font-semibold">
                  {formatCurrency(g.amount)}
                  <span className="ml-1.5 text-xs font-normal text-[var(--ink-muted)]">
                    {pct}%
                  </span>
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1e2a44] to-[#4a6a9a] transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {g.subgroups.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5 border-l-2 border-[var(--accent-soft)] pl-3">
                  {g.subgroups.map((sg) => (
                    <li
                      key={sg.key}
                      className="flex justify-between text-xs text-[var(--ink-muted)]"
                    >
                      <span>{sg.label}</span>
                      <span className="tabular-nums text-[var(--ink)]">
                        {formatCurrency(sg.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--surface-2)] px-3 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Property management</span>
          <span className="tabular-nums font-semibold">{formatCurrency(mgmt)}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Ops (Israel) — separate from reno capital.
        </p>
      </div>
    </section>
  );
}
