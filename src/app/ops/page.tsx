"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import { buildMonthlyOps, type MonthOpsRow } from "@/lib/monthly-ops";

export default function OpsPage() {
  const { ready, property, units, transactions, updateUnit } = useData();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const rows = useMemo(
    () =>
      buildMonthlyOps({
        transactions,
        units,
        purchaseDate: property.purchase_date,
        mortgageFallback: property.monthly_mortgage_total,
        asOf: new Date(),
        futureMonths: 6,
      }),
    [transactions, units, property]
  );

  const defaultKey = useMemo(() => {
    const withIncome = [...rows].reverse().find((r) => r.incomeTotal > 0 && r.kind === "actual");
    return withIncome?.key ?? rows.filter((r) => r.kind === "actual").at(-1)?.key ?? rows[0]?.key ?? null;
  }, [rows]);

  const selected =
    rows.find((r) => r.key === (selectedKey ?? defaultKey)) ||
    rows[0];

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.label.replace(" 20", " '"),
        income: r.incomeTotal,
        costs: r.costsTotal,
        net: r.net,
        kind: r.kind,
      })),
    [rows]
  );

  if (!ready || !selected) {
    return (
      <main className="app-shell flex items-center justify-center p-6">
        <p className="text-[var(--ink-muted)]">Loading ops…</p>
      </main>
    );
  }

  return (
    <main className="app-shell px-4 pb-8 pt-5">
      <header className="animate-rise">
        <p className="section-kicker">Operating P&amp;L</p>
        <h1 className="display mt-1 text-[2.4rem] font-semibold leading-none">Monthly ops</h1>
        <p className="mt-2 text-sm leading-snug text-[var(--ink-muted)]">
          Income by unit vs run cost. Capital reno stays off this ledger.
        </p>
      </header>

      <section className="panel animate-fade mt-4 p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="section-kicker">Trend</p>
            <h2 className="display text-xl font-semibold">Income vs costs</h2>
          </div>
          <span className="pill pill-brass">6-mo forecast</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,34,28,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5c677a" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v ?? 0))}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(20,28,43,0.08)",
                  background: "rgba(245,247,251,0.95)",
                  fontSize: 12,
                  boxShadow: "0 12px 30px rgba(20,28,43,0.12)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" name="Income" fill="#1f7a8c" radius={[7, 7, 0, 0]} />
              <Bar dataKey="costs" name="Ops cost" fill="#1e2a44" fillOpacity={0.4} radius={[7, 7, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[0.7rem] text-[var(--ink-muted)]">
          Earlier months = actuals · later = projections. 1R stays $0 while under renovation.
        </p>
      </section>

      <section className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelectedKey(r.key)}
            className={`month-chip ${selected.key === r.key ? "active" : ""}`}
          >
            <div className="font-semibold">{r.label}</div>
            <div className={selected.key === r.key ? "opacity-80" : "text-[var(--ink-muted)]"}>
              {r.dataLag ? "Lagging" : r.kind === "projected" ? "Projected" : "Actual"}
            </div>
          </button>
        ))}
      </section>

      <MonthDetail row={selected} />

      <section className="panel animate-fade mt-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="section-kicker">Assumptions</p>
            <h2 className="display text-xl font-semibold">Expected rents</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost px-3 py-1 text-sm"
            onClick={() => setShowAssumptions((v) => !v)}
          >
            {showAssumptions ? "Hide" : "Edit"}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Future months use these rents. 1R projects $0 until renovation is marked complete.
        </p>
        {showAssumptions ? (
          <div className="mt-3 space-y-3">
            {units.map((u) => (
              <div key={u.id} className="field">
                <label>
                  {u.code} expected monthly rent
                  {u.status === "under_renovation" ? " (held at $0 in projections)" : ""}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={u.expected_monthly_rent}
                  onChange={(e) =>
                    updateUnit(u.id, {
                      expected_monthly_rent: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {units.map((u) => (
              <li key={u.id} className="flex justify-between border-b border-[var(--line)] py-2.5 last:border-0">
                <span className="text-[var(--ink-muted)]">
                  {u.code}
                  {u.status === "under_renovation" ? " · reno" : ""}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(u.expected_monthly_rent)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/settings" className="mt-3 inline-block text-sm text-[var(--accent)] underline">
          Connect Gmail for PSE&amp;G / Veolia bills →
        </Link>
      </section>
    </main>
  );
}

function MonthDetail({ row }: { row: MonthOpsRow }) {
  return (
    <section className="panel animate-fade mt-4 overflow-hidden p-0">
      <div className="bg-gradient-to-br from-[#1e2a44] via-[#2a3d5f] to-[#152038] px-4 py-4 text-[#f2f5fb]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[rgba(242,245,251,0.5)]">
              {row.kind === "projected" ? "Projection" : "Actual"}
              {row.dataLag ? " · data lag" : " · ops only"}
            </p>
            <h2 className="display mt-1 text-2xl font-semibold">{row.label}</h2>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[rgba(242,245,251,0.5)]">
              Net
            </p>
            <p
              className={`display text-2xl font-semibold tabular-nums ${
                row.net >= 0 ? "text-[#9fd4e0]" : "text-[#f0c9a0]"
              }`}
            >
              {formatCurrency(row.net)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-[rgba(242,245,251,0.5)]">
              Income
            </p>
            <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(row.incomeTotal)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-[rgba(242,245,251,0.5)]">
              Ops cost
            </p>
            <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(row.costsTotal)}</p>
          </div>
        </div>
      </div>

      {row.dataLag ? (
        <div className="border-b border-[var(--line)] bg-[rgba(181,106,47,0.08)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warn)]">
            Statement lag
            {row.dataLag.accounts.length
              ? ` · ${row.dataLag.accounts.join(", ")}`
              : ""}
          </p>
          <ul className="mt-1 space-y-1 text-sm text-[var(--ink-muted)]">
            {row.dataLag.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>
              Live bank rows are included now; when the monthly PDF arrives, mark coverage
              current and reconcile any duplicates.
            </li>
          </ul>
        </div>
      ) : null}

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Income by unit
        </h3>
        <ul className="mt-1 space-y-1">
          {row.incomeByUnit.map((u) => (
            <li
              key={u.unitId}
              className="flex items-center justify-between border-b border-[var(--line)] py-2.5 text-sm last:border-0"
            >
              <span>
                {u.code}
                {u.status === "under_renovation" ? (
                  <span className="ml-2 text-[0.7rem] text-[var(--warn)]">under reno</span>
                ) : null}
                {u.missingActual ? (
                  <span className="ml-2 text-[0.7rem] text-[var(--warn)]">not posted</span>
                ) : null}
              </span>
              <span
                className={`font-semibold tabular-nums ${
                  u.missingActual ? "text-[var(--ink-muted)]" : "text-[var(--good)]"
                }`}
              >
                {formatCurrency(u.amount)}
              </span>
            </li>
          ))}
        </ul>

        {row.incomeLines.length > 0 ? (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Payments counted this month
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {row.incomeLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">
                      {line.title}
                      {line.importSource === "live" ? (
                        <span className="ml-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--warn)]">
                          live
                        </span>
                      ) : null}
                      {line.importSource === "manual" ? (
                        <span className="ml-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                          manual
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] text-[var(--ink-muted)]">
                      {line.unitCode ? `${line.unitCode} · ` : ""}
                      received {line.receivedOn}
                      {line.appliesOn !== line.receivedOn
                        ? ` · applied ${line.appliesOn.slice(0, 7)}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--good)]">
                    {formatCurrency(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : row.kind === "actual" ? (
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            No income payments applied to this month yet.
          </p>
        ) : null}

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Operating costs
        </h3>
        <ul className="mt-1 space-y-1 text-sm">
          <CostRow label="Mortgage (PITI)" value={row.costs.mortgage} />
          <CostRow label="Utilities (PSE&G)" value={row.costs.utilities} />
          <CostRow label="Water (Veolia)" value={row.costs.water} />
          <CostRow label="Property management" value={row.costs.management} />
          {row.costs.otherOps > 0 ? (
            <CostRow label="Other ops" value={row.costs.otherOps} />
          ) : null}
        </ul>
      </div>
    </section>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="font-semibold tabular-nums">{formatCurrency(value)}</span>
    </li>
  );
}
