"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MetricTile } from "@/components/metric-tile";
import { RenoBreakdownPanel } from "@/components/reno-breakdown-panel";
import { BreakevenBreakdown } from "@/components/breakeven-breakdown";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import { buildMonthlyOps } from "@/lib/monthly-ops";

export default function DashboardPage() {
  const { ready, property, metrics, transactions, units, partnerName } = useData();
  const [showSetup, setShowSetup] = useState(false);

  const opsRows = useMemo(
    () =>
      buildMonthlyOps({
        transactions,
        units,
        purchaseDate: property.purchase_date,
        mortgageFallback: property.monthly_mortgage_total,
        futureMonths: 3,
      }),
    [transactions, units, property]
  );

  const latestActual = opsRows.filter((r) => r.kind === "actual").at(-1);
  const chartData = useMemo(
    () =>
      opsRows.map((r) => ({
        name: r.label.replace(" 20", " '"),
        income: r.incomeTotal,
        costs: r.costsTotal,
      })),
    [opsRows]
  );

  if (!ready) {
    return (
      <main className="app-shell flex items-center justify-center p-6">
        <p className="text-[var(--ink-muted)]">Loading Luris…</p>
      </main>
    );
  }

  const net = latestActual?.net ?? metrics.monthNet;

  return (
    <main className="app-shell px-4 pb-8 pt-5">
      <header className="hero-plane animate-rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgba(242,245,251,0.55)]">
              16 Weldon · Jersey City
            </p>
            <h1 className="display mt-2 text-[3.15rem] font-semibold leading-[0.92] tracking-tight">
              Luris
            </h1>
            <p className="mt-3 max-w-[16.5rem] text-[0.92rem] leading-snug text-[rgba(242,245,251,0.68)]">
              Your four-flat ledger — capital, monthly run cost, and break-even.
            </p>
          </div>
          <button
            type="button"
            className="pill pill-ghost"
            onClick={() => setShowSetup((v) => !v)}
          >
            {partnerName.split(" ")[0]} + you
          </button>
        </div>

        <div className="mt-7">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[rgba(242,245,251,0.5)]">
            {latestActual ? `${latestActual.label} ops net` : "Ops net"}
          </p>
          <p
            className={`display mt-1 text-[2.75rem] font-semibold leading-none ${
              net >= 0 ? "text-[#9fd4e0]" : "text-[#f0c9a0]"
            }`}
          >
            {formatCurrency(net)}
          </p>
          {latestActual ? (
            <p className="mt-2 text-xs text-[rgba(242,245,251,0.55)]">
              {formatCurrency(latestActual.incomeTotal)} in ·{" "}
              {formatCurrency(latestActual.costsTotal)} ops out
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex gap-2">
          <Link href="/ops" className="btn btn-hero flex-1 text-center">
            Monthly ops
          </Link>
          <Link href="/income" className="btn btn-hero flex-1 text-center">
            Log income
          </Link>
        </div>
      </header>

      {showSetup ? (
        <section className="panel animate-fade mt-4 p-4 text-sm text-[var(--ink-muted)]">
          <p>
            <strong className="text-[var(--ink)]">Local mode</strong> — closed Feb 9, 2026 ·
            Sale {formatCurrency(property.sale_price)} · Loan{" "}
            {formatCurrency(property.loan_amount)} @ {property.interest_rate}%.
          </p>
          <Link href="/settings" className="mt-3 inline-block text-[var(--accent)] underline">
            Open settings
          </Link>
        </section>
      ) : null}

      <section className="stagger mt-4 grid grid-cols-2 gap-3">
        <MetricTile
          label="Break-even"
          value={metrics.breakEven}
          tone="accent"
          hint="Cover this each month"
        />
        <MetricTile
          label="Invested"
          value={metrics.totalInvested}
          hint="Down + closing + reno"
        />
      </section>

      <section className="panel animate-fade mt-4 p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="section-kicker">Pulse</p>
            <h2 className="display text-xl font-semibold">Income vs ops</h2>
          </div>
          <span className="pill pill-brass">Actual + forecast</span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
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
              <Bar dataKey="income" name="Income" fill="#1f7a8c" radius={[7, 7, 0, 0]} />
              <Bar dataKey="costs" name="Ops cost" fill="#1e2a44" radius={[7, 7, 0, 0]} fillOpacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel animate-fade mt-4 p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="section-kicker">Capital</p>
            <h2 className="display text-xl font-semibold">Where money went</h2>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <Row label="Down payment" value={metrics.downPayment} />
          <Row label="Closing + proration" value={metrics.closingCosts} />
          <Row label="Renovation" value={metrics.renovationSpend} />
        </div>
      </section>

      <BreakevenBreakdown
        transactions={transactions}
        mortgageFallback={property.monthly_mortgage_total}
      />

      <RenoBreakdownPanel transactions={transactions} />
    </main>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="font-semibold tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
