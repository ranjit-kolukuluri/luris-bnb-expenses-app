export type TransactionType = "expense" | "income";
export type Cadence = "one_time" | "recurring";
export type MemberRole = "owner" | "partner";

/** High-level reno / ops spend type for distribution views */
export type ExpenseGroup =
  | "contractor_fees"
  | "materials"
  | "interior_design"
  | "property_management";

export type ExpenseSubgroup =
  | "labor"
  | "construction"
  | "furniture"
  | "online_marketplace"
  | "appliances"
  | "other"
  | "lulu"
  | "monthly_mgmt"
  | "hosting_fees";

export interface Property {
  id: string;
  name: string;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  purchase_date: string;
  sale_price: number;
  loan_amount: number;
  interest_rate: number;
  monthly_pi: number;
  monthly_mi: number;
  monthly_escrow: number;
  monthly_mortgage_total: number;
}

export type UnitStatus = "active" | "under_renovation" | "vacant";

export interface Unit {
  id: string;
  property_id: string;
  code: string;
  label: string;
  beds: number;
  baths: number;
  rental_model: string;
  status: UnitStatus;
  /** Expected monthly rent used for future projections */
  expected_monthly_rent: number;
  sort_order: number;
}

export interface Category {
  id: string;
  property_id: string;
  name: string;
  kind: TransactionType;
  cadence: Cadence;
  sort_order: number;
}

export interface Transaction {
  id: string;
  property_id: string;
  unit_id: string | null;
  category_id: string | null;
  type: TransactionType;
  cadence: Cadence;
  title: string;
  description: string | null;
  amount: number;
  /** Bank / payout date */
  occurred_on: string;
  /**
   * Operating month this income/expense belongs to (YYYY-MM-DD, typically 1st).
   * Monthly ops uses this when present; otherwise occurred_on.
   */
  applies_on?: string | null;
  payment_account: string | null;
  vendor: string | null;
  is_seeded: boolean;
  /**
   * How the row entered the ledger.
   * - statement: from a closed monthly PDF/CSV
   * - live: bank activity before the month's statement exists
   * - manual: typed in by a partner
   */
  import_source?: "statement" | "live" | "manual" | null;
  expense_group?: ExpenseGroup | null;
  expense_subgroup?: ExpenseSubgroup | null;
  created_at?: string;
}

/** Last day covered by an imported monthly statement for a payment account */
export interface StatementCoverage {
  account: string;
  through: string; // YYYY-MM-DD
  label: string;
}

export interface DocumentRow {
  id: string;
  property_id: string;
  transaction_id: string | null;
  title: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  totalInvested: number;
  downPayment: number;
  closingCosts: number;
  renovationSpend: number;
  monthlyFixedCost: number;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  ytdIncome: number;
  ytdExpense: number;
  ytdNet: number;
  breakEven: number;
  profitGap: number;
}

export interface RenoTypeBreakdown {
  group: ExpenseGroup;
  label: string;
  amount: number;
  subgroups: { key: string; label: string; amount: number }[];
}
