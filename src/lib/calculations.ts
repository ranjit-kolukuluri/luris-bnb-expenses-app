import type {
  DashboardMetrics,
  ExpenseGroup,
  RenoTypeBreakdown,
  Transaction,
} from "./types";
import {
  EXPENSE_GROUP_LABELS,
  EXPENSE_SUBGROUP_LABELS,
} from "./seed";
import { inMonth as inCalendarMonth, opsMonthDate } from "./monthly-ops";

const money = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export function isInMonth(dateStr: string, year: number, month: number) {
  return inCalendarMonth(dateStr, year, month);
}

export function isInYear(dateStr: string, year: number) {
  const m = /^(\d{4})/.exec(dateStr);
  if (m) return Number(m[1]) === year;
  return new Date(dateStr + "T12:00:00").getFullYear() === year;
}

const isCapital = (t: Transaction) =>
  Boolean(t.expense_group && t.expense_group !== "property_management") ||
  /down payment|closing|tax proration|inspection/i.test(t.title);

const isRenoCapital = (t: Transaction) =>
  t.type === "expense" &&
  (t.expense_group === "contractor_fees" ||
    t.expense_group === "materials" ||
    t.expense_group === "interior_design");

export function computeRenoBreakdown(transactions: Transaction[]): {
  total: number;
  groups: RenoTypeBreakdown[];
} {
  const renoGroups: ExpenseGroup[] = [
    "contractor_fees",
    "materials",
    "interior_design",
  ];

  const groups: RenoTypeBreakdown[] = renoGroups.map((group) => {
    const rows = transactions.filter(
      (t) => t.type === "expense" && t.expense_group === group && Number(t.amount) > 0
    );
    const subgroupMap = new Map<string, number>();
    for (const t of rows) {
      const key = t.expense_subgroup || "other";
      subgroupMap.set(key, (subgroupMap.get(key) || 0) + Number(t.amount));
    }
    return {
      group,
      label: EXPENSE_GROUP_LABELS[group],
      amount: money(rows.reduce((s, t) => s + Number(t.amount), 0)),
      subgroups: Array.from(subgroupMap.entries())
        .map(([key, amount]) => ({
          key,
          label:
            EXPENSE_SUBGROUP_LABELS[key as keyof typeof EXPENSE_SUBGROUP_LABELS] ||
            key,
          amount: money(amount),
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  });

  const total = money(groups.reduce((s, g) => s + g.amount, 0));
  return { total, groups: groups.filter((g) => g.amount > 0) };
}

export function computePropertyMgmtTotal(transactions: Transaction[]) {
  return money(
    transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.expense_group === "property_management" &&
          Number(t.amount) > 0
      )
      .reduce((s, t) => s + Number(t.amount), 0)
  );
}

export function computeMetrics(
  transactions: Transaction[],
  opts: { year: number; month: number; mortgageFallback?: number }
): DashboardMetrics {
  const { year, month, mortgageFallback = 0 } = opts;

  const expenses = transactions.filter((t) => t.type === "expense");
  const income = transactions.filter((t) => t.type === "income");

  const oneTime = expenses.filter((t) => t.cadence === "one_time" && t.amount > 0);
  const capitalOneTime = oneTime.filter(isCapital);
  const totalInvested = money(
    capitalOneTime.reduce((s, t) => s + Number(t.amount), 0)
  );

  const downPayment = money(
    oneTime
      .filter((t) => /down payment/i.test(t.title))
      .reduce((s, t) => s + Number(t.amount), 0)
  );

  const closingCosts = money(
    oneTime
      .filter((t) => /closing|tax proration|inspection/i.test(t.title))
      .reduce((s, t) => s + Number(t.amount), 0)
  );

  const renovationSpend = money(
    expenses.filter(isRenoCapital).reduce((s, t) => s + Number(t.amount), 0)
  );

  const recurringExpenses = expenses.filter((t) => t.cadence === "recurring");
  let monthlyFixedCost = money(
    recurringExpenses.reduce((s, t) => s + Number(t.amount), 0)
  );
  if (monthlyFixedCost === 0 && mortgageFallback > 0) {
    monthlyFixedCost = mortgageFallback;
  }

  const monthIncome = money(
    income
      .filter((t) => isInMonth(opsMonthDate(t), year, month))
      .reduce((s, t) => s + Number(t.amount), 0)
  );

  const monthOneOff = money(
    expenses
      .filter(
        (t) =>
          t.cadence === "one_time" &&
          isInMonth(opsMonthDate(t), year, month) &&
          !t.is_seeded
      )
      .reduce((s, t) => s + Number(t.amount), 0)
  );

  const monthExpense = money(monthlyFixedCost + monthOneOff);
  const monthNet = money(monthIncome - monthExpense);

  const ytdIncome = money(
    income
      .filter((t) => isInYear(t.occurred_on, year))
      .reduce((s, t) => s + Number(t.amount), 0)
  );

  const monthsElapsed = month + 1;

  const ytdOpsOneOff = money(
    expenses
      .filter(
        (t) =>
          t.cadence === "one_time" &&
          isInYear(t.occurred_on, year) &&
          Number(t.amount) > 0 &&
          !isCapital(t)
      )
      .reduce((s, t) => s + Number(t.amount), 0)
  );
  const ytdExpense = money(monthlyFixedCost * monthsElapsed + ytdOpsOneOff);

  const breakEven = monthlyFixedCost;
  const profitGap = money(monthIncome - breakEven);

  return {
    totalInvested,
    downPayment,
    closingCosts,
    renovationSpend,
    monthlyFixedCost,
    monthIncome,
    monthExpense,
    monthNet,
    ytdIncome,
    ytdExpense,
    ytdNet: money(ytdIncome - ytdExpense),
    breakEven,
    profitGap,
  };
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompact(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
