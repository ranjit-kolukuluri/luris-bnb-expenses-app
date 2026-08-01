"use client";

import { useMemo } from "react";
import { RenoBreakdownPanel } from "@/components/reno-breakdown-panel";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import { RENO_TOTALS } from "@/lib/seed";
import type { Transaction, Unit } from "@/lib/types";

export default function UnitsPage() {
  const { units, transactions, updateUnit } = useData();

  const rows = useMemo(() => {
    // Helper function to match transactions to units (same logic as monthly-ops)
    const matchesUnit = (t: Transaction, unit: Unit): boolean => {
      // Direct match via unit_id (most reliable)
      if (t.unit_id && t.unit_id === unit.id) return true;
      
      // Explicit code in title
      if (new RegExp(`\\b${unit.code}\\b`, "i").test(t.title)) return true;
      
      // Vendor-based heuristics with stricter type checking
      const blob = `${t.title} ${t.vendor ?? ""}`.toLowerCase();
      
      if (unit.code === "1L") {
        // Ariel is 1L tenant
        if (/ariel|arial/i.test(blob) && /rent|payment|zelle/i.test(t.title)) return true;
      }
      
      if (unit.code === "2R") {
        // Airbnb income goes to 2R
        if (/airbnb/i.test(blob) && t.type === "income") return true;
      }
      
      if (unit.code === "2L") {
        // Apartments.com with Moral or Adade tenants
        if (/apartments\.com|apts\.com/i.test(blob) && t.type === "income") return true;
        if ((/moral|adade/i.test(blob)) && t.type === "income" && !blob.includes("refund")) return true;
      }
      
      return false;
    };

    return units.map((unit) => {
      const related = transactions.filter((t) => matchesUnit(t, unit));
      // Use expense_group instead of title keywords for accurate capital expense tracking
      const reno = related
        .filter((t) => 
          t.type === "expense" && 
          t.expense_group && 
          ["contractor_fees", "materials", "interior_design"].includes(t.expense_group)
        )
        .reduce((s, t) => s + Number(t.amount), 0);
      const income = related
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
      return { unit, reno, income, count: related.length };
    });
  }, [units, transactions]);

  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          Four-flat
        </p>
        <h1 className="display text-3xl font-semibold">Units</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Materials split 60/20/20 (1R/1L/2R) · total reno{" "}
          {formatCurrency(RENO_TOTALS.grandReno)} · 1R still under renovation
        </p>
      </header>

      <section className="stagger mt-5 space-y-3">
        {rows.map(({ unit, reno, income, count }) => (
          <article key={unit.id} className="panel animate-fade p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="display text-2xl font-semibold text-[var(--accent)]">
                  {unit.code}
                </h2>
                <p className="text-sm text-[var(--ink-muted)]">{unit.label}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="pill capitalize">{unit.rental_model.replace("_", " ")}</span>
                {unit.status === "under_renovation" ? (
                  <span className="pill !bg-[var(--warn)] !text-white">Under renovation</span>
                ) : null}
              </div>
            </div>
            {unit.status === "under_renovation" ? (
              <p className="mt-2 text-xs text-[var(--warn)]">
                Full gut in progress — no rent expected until work completes. Costs will keep growing.
              </p>
            ) : null}
            {unit.code === "1R" ? (
              <button
                type="button"
                className="btn btn-ghost mt-2 px-3 py-1 text-xs"
                onClick={() =>
                  updateUnit(unit.id, {
                    status:
                      unit.status === "under_renovation" ? "active" : "under_renovation",
                  })
                }
              >
                {unit.status === "under_renovation"
                  ? "Mark renovation complete"
                  : "Mark under renovation"}
              </button>
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Beds" value={`${unit.beds}/${unit.baths}`} />
              <Stat label="Reno" value={formatCurrency(reno)} />
              <Stat
                label="Income"
                value={
                  unit.status === "under_renovation" ? "—" : formatCurrency(income)
                }
              />
            </div>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">{count} linked entries</p>
          </article>
        ))}

        <article className="panel animate-fade p-4">
          <h2 className="display text-xl font-semibold text-[var(--accent)]">Basement</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Fixed renovation cost center (owner-set $5,000).
          </p>
          <p className="mt-3 font-semibold tabular-nums">
            {formatCurrency(
              transactions
                .filter((t) => /basement/i.test(t.title))
                .reduce((s, t) => s + Number(t.amount), 0)
            )}{" "}
            <span className="text-sm font-normal text-[var(--ink-muted)]">reno to date</span>
          </p>
        </article>
      </section>

      <RenoBreakdownPanel transactions={transactions} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-2 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
