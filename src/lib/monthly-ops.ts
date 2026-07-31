import type { ExpenseGroup, StatementCoverage, Transaction, Unit } from "./types";
import { 
  STATEMENT_COVERAGE, 
  MONTHLY_MANAGEMENT_COSTS, 
  DEFAULT_MONTHLY_MANAGEMENT 
} from "./seed";

export type MonthKind = "actual" | "projected";

export interface UnitIncome {
  unitId: string;
  code: string;
  amount: number;
  status: Unit["status"];
  /** True when this month has other actual income but none posted for this unit */
  missingActual?: boolean;
}

export interface MonthOpsCosts {
  mortgage: number;
  utilities: number;
  water: number;
  management: number;
  otherOps: number;
}

export interface MonthIncomeLine {
  id: string;
  title: string;
  unitCode: string | null;
  amount: number;
  receivedOn: string;
  appliesOn: string;
  importSource?: Transaction["import_source"];
}

export interface MonthDataLag {
  /** Accounts whose last statement ends before this month */
  accounts: string[];
  /** Human-readable coverage notes */
  notes: string[];
  /** True when any income/expense in this month is marked live/manual past statement coverage */
  hasLiveRows: boolean;
}

export interface MonthOpsRow {
  key: string;
  year: number;
  month: number; // 0-11
  label: string;
  kind: MonthKind;
  incomeByUnit: UnitIncome[];
  incomeLines: MonthIncomeLine[];
  incomeTotal: number;
  costs: MonthOpsCosts;
  costsTotal: number;
  net: number;
  dataLag: MonthDataLag | null;
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function labelFor(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** Parse calendar date without timezone shifting. */
export function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!dateStr) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) };
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(dateStr.trim());
  if (us) {
    const year = Number(us[3].length === 2 ? `20${us[3]}` : us[3]);
    return { year, month: Number(us[1]) - 1, day: Number(us[2]) };
  }
  return null;
}

export function inMonth(dateStr: string, year: number, month: number) {
  const parts = parseDateParts(dateStr);
  if (!parts) return false;
  return parts.year === year && parts.month === month;
}

/** Month this txn counts toward in ops P&L */
export function opsMonthDate(t: Transaction): string {
  return t.applies_on || t.occurred_on;
}

/** Last calendar day of year/month (0-11). */
function monthEndDate(year: number, month: number): string {
  const last = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/**
 * Flag months that extend past imported bank statements.
 * Live bank rows (or any activity after coverage) → data lag banner on Ops.
 */
export function computeDataLag(
  year: number,
  month: number,
  monthTx: Transaction[],
  coverage: StatementCoverage[] = STATEMENT_COVERAGE
): MonthDataLag | null {
  const end = monthEndDate(year, month);
  const lagged = coverage.filter((c) => c.through < end);
  const hasLiveRows = monthTx.some(
    (t) => t.import_source === "live" || t.import_source === "manual"
  );
  if (!lagged.length && !hasLiveRows) return null;

  const accountsUsed = new Set(
    monthTx
      .map((t) => t.payment_account)
      .filter((a): a is string => Boolean(a))
  );
  const relevant = lagged.filter(
    (c) => accountsUsed.size === 0 || accountsUsed.has(c.account)
  );
  if (!relevant.length && !hasLiveRows) return null;

  const accounts = [...new Set(relevant.map((c) => c.account))];
  const notes = relevant.map(
    (c) =>
      `${c.account}: statement only through ${c.through.slice(0, 7)}; this month may be incomplete until the PDF lands.`
  );
  if (hasLiveRows && !notes.length) {
    notes.push(
      "Some rows are live bank activity entered before the monthly statement was available."
    );
  }
  return { accounts, notes, hasLiveRows };
}

function unitCodeFromTx(t: Transaction, units: Unit[]): string | null {
  if (t.unit_id) {
    const u = units.find((x) => x.id === t.unit_id);
    if (u) return u.code;
  }
  // Explicit unit code in title (highest priority after unit_id)
  const hit = /\b(1L|1R|2L|2R)\b/i.exec(t.title);
  if (hit) return hit[1].toUpperCase();
  
  // Vendor-specific patterns for income matching
  const blob = `${t.title} ${t.vendor ?? ""}`.toLowerCase();
  
  // 1L: Ariel rent payments
  if (/ariel|arial/i.test(blob) && /rent|payment|zelle/i.test(t.title)) return "1L";
  
  // 2R: Airbnb income
  if (/airbnb/i.test(blob) && t.type === "income") return "2R";
  
  // 2L: Apartments.com tenants (Moral and Adade)
  if (/apartments\.com|apts\.com/i.test(blob) && t.type === "income") return "2L";
  if ((/moral|adade/i.test(blob)) && t.type === "income" && !blob.includes("refund")) return "2L";
  
  return null;
}

function matchesUnit(t: Transaction, unit: Unit): boolean {
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
}

const CAPITAL_GROUPS = new Set<ExpenseGroup>([
  "contractor_fees",
  "materials",
  "interior_design",
]);

function isCapitalExpense(t: Transaction) {
  if (t.expense_group && CAPITAL_GROUPS.has(t.expense_group)) return true;
  return /down payment|closing|tax proration|inspection/i.test(t.title);
}

function recurringAmount(
  transactions: Transaction[],
  matcher: (t: Transaction) => boolean
) {
  return money(
    transactions
      .filter((t) => t.type === "expense" && t.cadence === "recurring" && matcher(t))
      .reduce((s, t) => s + Number(t.amount), 0)
  );
}

export function getRecurringOps(transactions: Transaction[], mortgageFallback: number) {
  const mortgage =
    recurringAmount(transactions, (t) => /mortgage/i.test(t.title)) || mortgageFallback;
  const utilities = recurringAmount(
    transactions,
    (t) => /utilit|pse&g|pseg/i.test(t.title)
  );
  const water = recurringAmount(transactions, (t) => /water|viola|veolia/i.test(t.title));
  const management = recurringAmount(
    transactions,
    (t) =>
      t.expense_group === "property_management" ||
      /property management|monthly property/i.test(t.title)
  );
  return { mortgage, utilities, water, management };
}

/**
 * Build month-by-month operating P&L from purchase month through
 * `futureMonths` ahead of "today".
 */
export function buildMonthlyOps(opts: {
  transactions: Transaction[];
  units: Unit[];
  purchaseDate: string;
  mortgageFallback: number;
  asOf?: Date;
  futureMonths?: number;
}): MonthOpsRow[] {
  const {
    transactions,
    units,
    purchaseDate,
    mortgageFallback,
    asOf = new Date(),
    futureMonths = 6,
  } = opts;

  const purchaseParts = parseDateParts(purchaseDate) || {
    year: asOf.getFullYear(),
    month: asOf.getMonth(),
    day: 1,
  };
  const startYear = purchaseParts.year;
  const startMonth = purchaseParts.month;
  const asOfYear = asOf.getFullYear();
  const asOfMonth = asOf.getMonth();

  const recurring = getRecurringOps(transactions, mortgageFallback);

  // Always include through the later of (asOf+future) or last income applies month
  let endYear = asOfYear;
  let endMonth = asOfMonth + futureMonths;
  while (endMonth > 11) {
    endMonth -= 12;
    endYear += 1;
  }
  for (const t of transactions) {
    if (t.type !== "income") continue;
    const p = parseDateParts(opsMonthDate(t));
    if (!p) continue;
    if (p.year > endYear || (p.year === endYear && p.month > endMonth)) {
      endYear = p.year;
      endMonth = p.month;
    }
  }

  const rows: MonthOpsRow[] = [];

  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const isFuture = y > asOfYear || (y === asOfYear && m > asOfMonth);

    const monthIncomeTx = transactions.filter(
      (t) => t.type === "income" && inMonth(opsMonthDate(t), y, m)
    );
    const hasActualIncome = monthIncomeTx.length > 0;

    // Past / current months with ledger income = actual.
    // Future months, or current month with nothing posted yet = projected.
    const kind: MonthKind =
      isFuture || (y === asOfYear && m === asOfMonth && !hasActualIncome)
        ? "projected"
        : hasActualIncome || !isFuture
          ? "actual"
          : "projected";

    const incomeByUnit: UnitIncome[] = units.map((unit) => {
      if (kind === "projected" && !hasActualIncome) {
        const amount =
          unit.status === "under_renovation"
            ? 0
            : Number(unit.expected_monthly_rent || 0);
        return {
          unitId: unit.id,
          code: unit.code,
          amount: money(amount),
          status: unit.status,
        };
      }
      const amount = money(
        monthIncomeTx
          .filter((t) => matchesUnit(t, unit))
          .reduce((s, t) => s + Number(t.amount), 0)
      );
      const missingActual =
        kind === "actual" &&
        hasActualIncome &&
        amount === 0 &&
        unit.status !== "under_renovation";
      return {
        unitId: unit.id,
        code: unit.code,
        amount,
        status: unit.status,
        missingActual,
      };
    });

    // Unassigned income (no unit match) still counts in total
    const assigned = money(incomeByUnit.reduce((s, u) => s + u.amount, 0));
    const unassigned = money(
      monthIncomeTx
        .filter((t) => !units.some((u) => matchesUnit(t, u)))
        .reduce((s, t) => s + Number(t.amount), 0)
    );
    const incomeTotal =
      kind === "projected" && !hasActualIncome
        ? money(incomeByUnit.reduce((s, u) => s + u.amount, 0))
        : money(assigned + unassigned);

    const incomeLines: MonthIncomeLine[] = monthIncomeTx.map((t) => ({
      id: t.id,
      title: t.title,
      unitCode: unitCodeFromTx(t, units),
      amount: Number(t.amount),
      receivedOn: t.occurred_on,
      appliesOn: opsMonthDate(t),
      importSource: t.import_source ?? null,
    }));

    const monthAllTx = transactions.filter(
      (t) =>
        (t.type === "income" || t.type === "expense") &&
        t.cadence !== "recurring" &&
        inMonth(opsMonthDate(t), y, m)
    );
    const dataLag = computeDataLag(y, m, monthAllTx);

    const actualUtilities = money(
      transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.cadence === "one_time" &&
            inMonth(opsMonthDate(t), y, m) &&
            /pse&g|pseg|utilit/i.test(t.title)
        )
        .reduce((s, t) => s + Number(t.amount), 0)
    );
    const waterActualTxs = transactions.filter(
      (t) =>
        t.type === "expense" &&
        t.cadence === "one_time" &&
        inMonth(opsMonthDate(t), y, m) &&
        /water|viola|veolia/i.test(t.title)
    );
    const hasActualWater = waterActualTxs.length > 0;
    const actualWater = money(
      waterActualTxs.reduce((s, t) => s + Number(t.amount), 0)
    );
    const mgmtTxs = transactions.filter(
      (t) =>
        t.type === "expense" &&
        t.cadence === "one_time" &&
        inMonth(opsMonthDate(t), y, m) &&
        (t.expense_group === "property_management" ||
          /hosting fee|property management/i.test(t.title))
    );
    const actualMgmtMonthly = money(
      mgmtTxs
        .filter(
          (t) =>
            t.expense_subgroup === "monthly_mgmt" ||
            /property management/i.test(t.title)
        )
        .reduce((s, t) => s + Number(t.amount), 0)
    );
    const actualMgmtOther = money(
      mgmtTxs
        .filter(
          (t) =>
            t.expense_subgroup !== "monthly_mgmt" &&
            !/property management/i.test(t.title)
        )
        .reduce((s, t) => s + Number(t.amount), 0)
    );

    // Get expected management cost from monthly table
    const monthKeyStr = `${y}-${String(m + 1).padStart(2, "0")}`;
    const expectedMgmt = MONTHLY_MANAGEMENT_COSTS[monthKeyStr] ?? DEFAULT_MONTHLY_MANAGEMENT;

    const otherOps = money(
      transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.cadence === "one_time" &&
            inMonth(opsMonthDate(t), y, m) &&
            !isCapitalExpense(t) &&
            !/pse&g|pseg|utilit|water|viola|veolia|hosting fee|property management/i.test(
              t.title
            ) &&
            t.expense_group !== "property_management"
        )
        .reduce((s, t) => s + Number(t.amount), 0)
    );

    const useActualCosts = kind === "actual" || hasActualIncome;

    const costs: MonthOpsCosts = {
      mortgage: recurring.mortgage,
      utilities:
        useActualCosts && actualUtilities > 0
          ? actualUtilities
          : recurring.utilities,
      water:
        useActualCosts && hasActualWater ? actualWater : recurring.water,
      management: useActualCosts
        ? money(
            (actualMgmtMonthly > 0 ? actualMgmtMonthly : expectedMgmt) +
              actualMgmtOther
          )
        : expectedMgmt,
      otherOps: useActualCosts ? otherOps : 0,
    };

    const costsTotal = money(
      costs.mortgage +
        costs.utilities +
        costs.water +
        costs.management +
        costs.otherOps
    );

    rows.push({
      key: monthKey(y, m),
      year: y,
      month: m,
      label: labelFor(y, m),
      kind: hasActualIncome ? "actual" : kind,
      incomeByUnit,
      incomeLines,
      incomeTotal,
      costs,
      costsTotal,
      net: money(incomeTotal - costsTotal),
      dataLag,
    });

    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return rows;
}
