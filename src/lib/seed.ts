import type {
  Category,
  ExpenseGroup,
  ExpenseSubgroup,
  Property,
  Transaction,
  Unit,
} from "./types";

/**
 * Renovation cost model
 * ----------------------
 * Total reno ≈ Contractor fees (James/Artway) + Materials/goods + Interior design (Lulu/1R)
 *              + Appliances (Best Buy, PC Richard)
 *
 * Materials (Chase classified + Prime Amazon) still allocated to units 60/20/20 → 1R/1L/2R.
 * Non-property Chase charges (car, travel, food, etc.) are excluded from reno.
 */

export const PAYEE_ALIASES = {
  james: "James / Artway Contractors LLC",
  israel: "Israel Adeyanju / Is A Realtor",
  ariel: "Ariel Y Blanca (1L)",
  lulu: "Lulu (interior design via Israel)",
} as const;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Classified goods from Chase + Prime + Best Buy (BoA) — Micro Center excluded */
export const MATERIALS_BY_SUBGROUP = {
  construction: 9040.73, // Home Depot, tile, electric, paint/hardware, Kearny Kitchen
  furniture: 4871.24, // Wayfair, Homegoods, Marshalls, At Home
  online_marketplace: 5642.91, // Amazon/Prime + Temu/Shein/Target/Walmart/Michaels
  appliances: 1171.57, // Best Buy $715.31 + PC Richard $456.26
  other: 30.2, // misc small stores
} as const;

export const MATERIALS_POOL = round2(
  Object.values(MATERIALS_BY_SUBGROUP).reduce((s, n) => s + n, 0)
); // ~20,756.65

export const MATERIALS_UNIT_SHARE = {
  "1R": 0.6,
  "1L": 0.2,
  "2R": 0.2,
} as const;

/** James/Artway contractor Zelle (excludes snow removal $125) */
export const CONTRACTOR_BY_UNIT = {
  "1L": 5500, // 2500 + 3000
  "1R": 6000, // 3000 + 3000
  "2R": 7200, // 1500 + 350 + 50 + 3000 + 2300 extra quote
  basement: 5000, // fixed basement reno
} as const;

export const INTERIOR_DESIGN_1R_LULU = 1000;
export const WINDOWS_2R_ISRAEL = 160;

export const SEED_PROPERTY: Property = {
  id: "local-property-luris",
  name: "Luris BnB",
  address_line: "16 Weldon St",
  city: "Jersey City",
  state: "NJ",
  zip: "07306",
  purchase_date: "2026-02-09",
  sale_price: 885000,
  loan_amount: 840750,
  interest_rate: 6.375,
  monthly_pi: 5245.19,
  monthly_mi: 301.27,
  monthly_escrow: 991.46,
  monthly_mortgage_total: 6537.92,
};

export const SEED_UNITS: Unit[] = [
  {
    id: "unit-1l",
    property_id: SEED_PROPERTY.id,
    code: "1L",
    label: "1L — 1 bed / 1 bath",
    beds: 1,
    baths: 1,
    rental_model: "flexible",
    status: "active",
    expected_monthly_rent: 2900,
    sort_order: 1,
  },
  {
    id: "unit-1r",
    property_id: SEED_PROPERTY.id,
    code: "1R",
    label: "1R — 3 bed / 1 bath",
    beds: 3,
    baths: 1,
    rental_model: "flexible",
    status: "under_renovation",
    // Target rent once renovation completes; projections keep $0 while under_renovation
    expected_monthly_rent: 3200,
    sort_order: 2,
  },
  {
    id: "unit-2l",
    property_id: SEED_PROPERTY.id,
    code: "2L",
    label: "2L — 1 bed / 1 bath",
    beds: 1,
    baths: 1,
    rental_model: "long_term",
    status: "active",
    expected_monthly_rent: 1595, // Moral $595 + Adade $1,000 typical month
    sort_order: 3,
  },
  {
    id: "unit-2r",
    property_id: SEED_PROPERTY.id,
    code: "2R",
    label: "2R — 1 bed / 1 bath",
    beds: 1,
    baths: 1,
    rental_model: "airbnb",
    status: "active",
    expected_monthly_rent: 2500, // Airbnb midterm estimate — edit in Ops/Settings
    sort_order: 4,
  },
];

export const SEED_CATEGORIES: Category[] = [
  { id: "cat-down", property_id: SEED_PROPERTY.id, name: "Down Payment", kind: "expense", cadence: "one_time", sort_order: 1 },
  { id: "cat-closing", property_id: SEED_PROPERTY.id, name: "Closing Costs", kind: "expense", cadence: "one_time", sort_order: 2 },
  { id: "cat-inspection", property_id: SEED_PROPERTY.id, name: "Inspection", kind: "expense", cadence: "one_time", sort_order: 3 },
  { id: "cat-reno", property_id: SEED_PROPERTY.id, name: "Renovation", kind: "expense", cadence: "one_time", sort_order: 4 },
  { id: "cat-mortgage", property_id: SEED_PROPERTY.id, name: "Monthly Mortgage", kind: "expense", cadence: "recurring", sort_order: 5 },
  { id: "cat-water", property_id: SEED_PROPERTY.id, name: "Water Bill", kind: "expense", cadence: "recurring", sort_order: 6 },
  { id: "cat-utils", property_id: SEED_PROPERTY.id, name: "Utilities", kind: "expense", cadence: "recurring", sort_order: 7 },
  { id: "cat-mgmt", property_id: SEED_PROPERTY.id, name: "Property Management", kind: "expense", cadence: "recurring", sort_order: 8 },
  { id: "cat-ops", property_id: SEED_PROPERTY.id, name: "Ops / Maintenance", kind: "expense", cadence: "one_time", sort_order: 9 },
  { id: "cat-rent", property_id: SEED_PROPERTY.id, name: "Rent / Airbnb", kind: "income", cadence: "recurring", sort_order: 10 },
];

function tx(
  partial: Omit<Transaction, "property_id" | "is_seeded"> & { id: string }
): Transaction {
  return {
    property_id: SEED_PROPERTY.id,
    is_seeded: true,
    expense_group: partial.expense_group ?? null,
    expense_subgroup: partial.expense_subgroup ?? null,
    applies_on: partial.applies_on ?? null,
    ...partial,
  };
}

/** First day of month for ops attribution */
function monthStart(yyyyMmDd: string) {
  return `${yyyyMmDd.slice(0, 7)}-01`;
}

function materialsTx(
  unitCode: "1L" | "1R" | "2R",
  unitId: string,
  subgroup: ExpenseSubgroup,
  subgroupAmount: number,
  title: string,
  description: string
): Transaction {
  const share = MATERIALS_UNIT_SHARE[unitCode];
  return tx({
    id: `tx-mat-${unitCode.toLowerCase()}-${subgroup}`,
    unit_id: unitId,
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "materials",
    expense_subgroup: subgroup,
    title,
    description,
    amount: round2(subgroupAmount * share),
    occurred_on: "2026-05-22",
    payment_account: subgroup === "appliances" ? "BoA" : "Chase",
    vendor:
      subgroup === "appliances"
        ? "Best Buy + PC Richard"
        : subgroup === "online_marketplace"
          ? "Amazon / Prime / marketplaces"
          : "Chase card merchants",
  });
}

const materialEntries: Transaction[] = [];
for (const [subgroup, amount] of Object.entries(MATERIALS_BY_SUBGROUP) as [
  ExpenseSubgroup,
  number,
][]) {
  const labels: Record<string, string> = {
    construction: "Construction materials",
    furniture: "Furniture",
    online_marketplace: "Online marketplace",
    appliances: "Appliances (AC / Best Buy / PC Richard)",
    other: "Other materials",
  };
  for (const [code, unitId] of [
    ["1R", "unit-1r"],
    ["1L", "unit-1l"],
    ["2R", "unit-2r"],
  ] as const) {
    materialEntries.push(
      materialsTx(
        code,
        unitId,
        subgroup,
        amount,
        `${labels[subgroup]} — ${code} (${MATERIALS_UNIT_SHARE[code] * 100}%)`,
        `Part of ${labels[subgroup]} pool $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Unit split 60/20/20 (1R/1L/2R).`
      )
    );
  }
}

export const SEED_TRANSACTIONS: Transaction[] = [
  // —— Closing (CD) ——
  tx({
    id: "tx-down",
    unit_id: null,
    category_id: "cat-down",
    type: "expense",
    cadence: "one_time",
    expense_group: null,
    expense_subgroup: null,
    title: "Down Payment",
    description:
      "Purchase equity from CD: sale $885,000 − loan $840,750. Earnest deposit $7,500 applied toward cash to close of $53,917.89.",
    amount: 44250,
    occurred_on: "2026-02-09",
    payment_account: null,
    vendor: "Tomo Mortgage / Seller",
  }),
  tx({
    id: "tx-closing",
    unit_id: null,
    category_id: "cat-closing",
    type: "expense",
    cadence: "one_time",
    title: "Closing Costs (Borrower-Paid)",
    description:
      "CD total $16,834.77: loan costs $6,455.67 + other $10,629.10 − lender credits $250.",
    amount: 16834.77,
    occurred_on: "2026-02-09",
    payment_account: null,
    vendor: "Blue Waters Title LLC",
  }),
  tx({
    id: "tx-tax-proration",
    unit_id: null,
    category_id: "cat-closing",
    type: "expense",
    cadence: "one_time",
    title: "Tax Proration (Seller Prepaid)",
    description: "City/town taxes 02/09/26–04/01/26 due from borrower at closing (CD K.08).",
    amount: 1313.12,
    occurred_on: "2026-02-09",
    payment_account: null,
    vendor: "Hudson County",
  }),

  // —— Recurring ops ——
  tx({
    id: "tx-mortgage",
    unit_id: null,
    category_id: "cat-mortgage",
    type: "expense",
    cadence: "recurring",
    title: "Monthly Mortgage (PITI)",
    description: "P&I $5,245.19 + MI $301.27 + escrow $991.46. 30-yr fixed @ 6.375%.",
    amount: 6537.92,
    occurred_on: "2026-03-01",
    payment_account: "Chase",
    vendor: "Chase / Tomo Mortgage",
  }),
  tx({
    id: "tx-utils-recurring",
    unit_id: null,
    category_id: "cat-utils",
    type: "expense",
    cadence: "recurring",
    title: "Monthly Utilities (PSE&G)",
    description: "Recurring estimate from BoA PSE&G activity Feb–Jun 2026 (avg ~$472).",
    amount: 472.5,
    occurred_on: "2026-03-01",
    payment_account: "BoA",
    vendor: "PSE&G",
  }),
  tx({
    id: "tx-water-recurring",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "recurring",
    title: "Monthly Water (Veolia)",
    description:
      "Projection baseline from recent Veolia bills (~$177 avg of Jun–Jul). Historical months logged separately.",
    amount: 177.2,
    occurred_on: "2026-03-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),

  // —— Veolia water (actual monthly) ——
  // Mar+Apr billed together as $428.80 → split evenly for ops months
  tx({
    id: "tx-water-feb",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "one_time",
    title: "Veolia water — Feb 2026",
    description: "Monthly water charge.",
    amount: 376.3,
    occurred_on: "2026-02-28",
    applies_on: "2026-02-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),
  tx({
    id: "tx-water-mar",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "one_time",
    title: "Veolia water — Mar 2026",
    description: "Mar+Apr combined bill $428.80 — half allocated to March.",
    amount: 214.4,
    occurred_on: "2026-04-15",
    applies_on: "2026-03-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),
  tx({
    id: "tx-water-apr",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "one_time",
    title: "Veolia water — Apr 2026",
    description: "Mar+Apr combined bill $428.80 — half allocated to April.",
    amount: 214.4,
    occurred_on: "2026-04-15",
    applies_on: "2026-04-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),
  tx({
    id: "tx-water-may",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "one_time",
    title: "Veolia water — May 2026 (credit)",
    description: "Credit / adjustment (−$54.09).",
    amount: -54.09,
    occurred_on: "2026-05-31",
    applies_on: "2026-05-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),
  tx({
    id: "tx-water-jun",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "one_time",
    title: "Veolia water — Jun 2026",
    description: "Monthly water charge.",
    amount: 146.15,
    occurred_on: "2026-06-30",
    applies_on: "2026-06-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),
  tx({
    id: "tx-water-jul",
    unit_id: null,
    category_id: "cat-water",
    type: "expense",
    cadence: "one_time",
    title: "Veolia water — Jul 2026",
    description: "Monthly water charge.",
    amount: 208.24,
    occurred_on: "2026-07-31",
    applies_on: "2026-07-01",
    payment_account: "BoA",
    vendor: "Veolia",
  }),

  tx({
    id: "tx-mgmt-recurring",
    unit_id: null,
    category_id: "cat-mgmt",
    type: "expense",
    cadence: "recurring",
    expense_group: "property_management",
    expense_subgroup: "monthly_mgmt",
    title: "Monthly Property Management",
    description:
      "Based on Zelle to Is A Realtor (Israel Adeyanju) — May 2026 property management $609.03.",
    amount: 609.03,
    occurred_on: "2026-05-01",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.israel,
  }),

  // —— Materials by subgroup × unit ——
  ...materialEntries,

  // —— Contractor fees (James = Artway) ——
  tx({
    id: "tx-contractor-1l",
    unit_id: "unit-1l",
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "contractor_fees",
    expense_subgroup: "labor",
    title: "Contractor fees — 1L (James/Artway)",
    description: "Zelle: 02/25 advance $2,500 + 03/09 balance $3,000.",
    amount: CONTRACTOR_BY_UNIT["1L"],
    occurred_on: "2026-03-09",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.james,
  }),
  tx({
    id: "tx-contractor-1r",
    unit_id: "unit-1r",
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "contractor_fees",
    expense_subgroup: "labor",
    title: "Contractor fees — 1R (James/Artway)",
    description:
      "Zelle: 03/10 advance $3,000 + 03/11 second half $3,000. Unit still under renovation.",
    amount: CONTRACTOR_BY_UNIT["1R"],
    occurred_on: "2026-03-11",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.james,
  }),
  tx({
    id: "tx-contractor-2r",
    unit_id: "unit-2r",
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "contractor_fees",
    expense_subgroup: "labor",
    title: "Contractor fees — 2R (James/Artway)",
    description:
      "03/03 balance $1,500; 03/20 furniture assembly $350; 04/14 washer/dryer $50; 04/27 instalment $3,000; 04/13 basement&2R extra $2,300 (to 2R; basement line is fixed separately).",
    amount: CONTRACTOR_BY_UNIT["2R"],
    occurred_on: "2026-04-27",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.james,
  }),
  tx({
    id: "tx-contractor-basement",
    unit_id: null,
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "contractor_fees",
    expense_subgroup: "labor",
    title: "Contractor fees — Basement (James/Artway)",
    description: "Fixed basement renovation $5,000.",
    amount: CONTRACTOR_BY_UNIT.basement,
    occurred_on: "2026-02-24",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.james,
  }),
  tx({
    id: "tx-windows-2r",
    unit_id: "unit-2r",
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "contractor_fees",
    expense_subgroup: "labor",
    title: "Windows fixtures — 2R",
    description: "Zelle to Israel/Is A Realtor 05/20/26 for windows fixtures installation.",
    amount: WINDOWS_2R_ISRAEL,
    occurred_on: "2026-05-20",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.israel,
  }),

  // —— Interior design (1R / Lulu only) ——
  tx({
    id: "tx-design-1r-lulu",
    unit_id: "unit-1r",
    category_id: "cat-reno",
    type: "expense",
    cadence: "one_time",
    expense_group: "interior_design",
    expense_subgroup: "lulu",
    title: "Interior design — 1R (Lulu)",
    description:
      "Zelle to Is A Realtor 05/26/26 — “1R - Interior Design - Advance to LULU”. Only applies to 1R (still under renovation).",
    amount: INTERIOR_DESIGN_1R_LULU,
    occurred_on: "2026-05-26",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.lulu,
  }),

  // —— Property management one-offs ——
  tx({
    id: "tx-airbnb-hosting",
    unit_id: "unit-2r",
    category_id: "cat-mgmt",
    type: "expense",
    cadence: "one_time",
    expense_group: "property_management",
    expense_subgroup: "hosting_fees",
    title: "Airbnb hosting fees",
    description: "Zelle to Is A Realtor (Israel) 04/21/26.",
    amount: 500,
    occurred_on: "2026-04-21",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.israel,
  }),

  // —— Other ops ——
  tx({
    id: "tx-snow",
    unit_id: null,
    category_id: "cat-ops",
    type: "expense",
    cadence: "one_time",
    title: "Snow removal — 16 Weldon",
    description: "James/Artway Zelle 02/25/26 (ops, not reno capital).",
    amount: 125,
    occurred_on: "2026-02-25",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.james,
  }),
  tx({
    id: "tx-tenant-refund-2r",
    unit_id: "unit-2r",
    category_id: "cat-ops",
    type: "expense",
    cadence: "one_time",
    title: "2R tenant refund",
    description: "Zelle to Is A Realtor (Israel) 05/05/26.",
    amount: 70,
    occurred_on: "2026-05-05",
    payment_account: "BoA",
    vendor: PAYEE_ALIASES.israel,
  }),

  // —— PSE&G historical ——
  tx({
    id: "tx-pseg-feb",
    unit_id: null,
    category_id: "cat-utils",
    type: "expense",
    cadence: "one_time",
    title: "PSE&G — Feb 2026",
    description: "BoA auto-pay.",
    amount: 324.18,
    occurred_on: "2026-02-25",
    payment_account: "BoA",
    vendor: "PSE&G",
  }),
  tx({
    id: "tx-pseg-mar",
    unit_id: null,
    category_id: "cat-utils",
    type: "expense",
    cadence: "one_time",
    title: "PSE&G — Mar 2026",
    description: "BoA auto-pay.",
    amount: 305.85,
    occurred_on: "2026-03-27",
    payment_account: "BoA",
    vendor: "PSE&G",
  }),
  tx({
    id: "tx-pseg-apr",
    unit_id: null,
    category_id: "cat-utils",
    type: "expense",
    cadence: "one_time",
    title: "PSE&G — Apr 2026",
    description: "Multiple meters on BoA statement totaling $687.04.",
    amount: 687.04,
    occurred_on: "2026-04-28",
    payment_account: "BoA",
    vendor: "PSE&G",
  }),
  tx({
    id: "tx-pseg-may",
    unit_id: null,
    category_id: "cat-utils",
    type: "expense",
    cadence: "one_time",
    title: "PSE&G — May 2026",
    description: "BoA auto-pay total $517.75.",
    amount: 517.75,
    occurred_on: "2026-05-27",
    payment_account: "BoA",
    vendor: "PSE&G",
  }),
  tx({
    id: "tx-pseg-jun",
    unit_id: null,
    category_id: "cat-utils",
    type: "expense",
    cadence: "one_time",
    title: "PSE&G — Jun 2026",
    description: "BoA auto-pay total $527.69.",
    amount: 527.69,
    occurred_on: "2026-06-26",
    payment_account: "BoA",
    vendor: "PSE&G",
  }),

  // —— Income: 1L (monthly rent totals; not bank scrapes) ——
  tx({
    id: "tx-rent-1l-may",
    unit_id: "unit-1l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "1L rent — Ariel Y Blanca (cash)",
    description: "May rent paid in cash — $3,000.",
    amount: 3000,
    occurred_on: "2026-05-15",
    applies_on: "2026-05-01",
    payment_account: "Cash / Other",
    vendor: "Ariel Y Blanca",
  }),
  tx({
    id: "tx-rent-1l-jun",
    unit_id: "unit-1l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "1L rent — Ariel Y Blanca (Zelle)",
    description: "June rent via Zelle to BoA — $2,800.",
    amount: 2800,
    occurred_on: "2026-06-01",
    applies_on: "2026-06-01",
    payment_account: "BoA",
    vendor: "Ariel Y Blanca",
  }),
  tx({
    id: "tx-rent-1l-jul",
    unit_id: "unit-1l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "1L rent — Ariel Y Blanca (Zelle)",
    description: "July rent via Zelle to BoA — $2,900.",
    amount: 2900,
    occurred_on: "2026-07-01",
    applies_on: "2026-07-01",
    payment_account: "BoA",
    vendor: "Ariel Y Blanca",
  }),

  // —— Income: 2L (Apartments.com → BlueVine) ——
  tx({
    id: "tx-rent-2l-0319",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Moral)",
    description: "BlueVine deposit. First month combined ($1,595) → March.",
    amount: 1595,
    occurred_on: "2026-03-19",
    applies_on: monthStart("2026-03-19"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Moral",
  }),
  tx({
    id: "tx-rent-2l-0406a",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Moral)",
    description: "BlueVine deposit → April rent.",
    amount: 595,
    occurred_on: "2026-04-06",
    applies_on: monthStart("2026-04-06"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Moral",
  }),
  tx({
    id: "tx-rent-2l-0406b",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Adade)",
    description: "BlueVine deposit → April rent.",
    amount: 1000,
    occurred_on: "2026-04-06",
    applies_on: monthStart("2026-04-06"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Adade",
  }),
  tx({
    id: "tx-rent-2l-0506a",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Moral)",
    description: "BlueVine deposit → May rent.",
    amount: 595,
    occurred_on: "2026-05-06",
    applies_on: monthStart("2026-05-06"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Moral",
  }),
  tx({
    id: "tx-rent-2l-0506b",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Adade)",
    description: "BlueVine deposit → May rent.",
    amount: 1000,
    occurred_on: "2026-05-06",
    applies_on: monthStart("2026-05-06"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Adade",
  }),
  tx({
    id: "tx-rent-2l-0603",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Moral)",
    description: "BlueVine deposit → June rent.",
    amount: 595,
    occurred_on: "2026-06-03",
    applies_on: monthStart("2026-06-03"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Moral",
  }),
  tx({
    id: "tx-rent-2l-0604",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Adade)",
    description: "BlueVine deposit → June rent.",
    amount: 1000,
    occurred_on: "2026-06-04",
    applies_on: monthStart("2026-06-04"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Adade",
  }),
  tx({
    id: "tx-rent-2l-0610",
    unit_id: "unit-2l",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2L rent — Apartments.com (Moral)",
    description: "BlueVine deposit — additional Moral payment → June.",
    amount: 310,
    occurred_on: "2026-06-10",
    applies_on: monthStart("2026-06-10"),
    payment_account: "BlueVine",
    vendor: "Apartments.com / Moral",
  }),

  // —— Income: 2R Airbnb ——
  // Early-month payout usually covers the prior month’s stays; late-month covers current.
  tx({
    id: "tx-airbnb-2r-may",
    unit_id: "unit-2r",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2R Airbnb payout — May",
    description:
      "AIRBNB → BlueVine received 06/01 ($1,865.31). Applied to May stays (~$1,895).",
    amount: 1865.31,
    occurred_on: "2026-06-01",
    applies_on: "2026-05-01",
    payment_account: "BlueVine",
    vendor: "Airbnb",
  }),
  tx({
    id: "tx-airbnb-2r-jun",
    unit_id: "unit-2r",
    category_id: "cat-rent",
    type: "income",
    cadence: "one_time",
    title: "2R Airbnb payout — June",
    description: "AIRBNB → BlueVine received 06/30. Applied to June stays.",
    amount: 3127.28,
    occurred_on: "2026-06-30",
    applies_on: "2026-06-01",
    payment_account: "BlueVine",
    vendor: "Airbnb",
  }),
  // July Airbnb payout — amount TBD once July BlueVine statement is available.
  // Leaving unset so Ops does not invent a figure; add via Income when known.
];

export const PAYMENT_ACCOUNTS = [
  "Chase",
  "BoA",
  "BlueVine",
  "Prime",
  "Airbnb",
  "Apartments.com",
  "Cash / Other",
] as const;

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  contractor_fees: "Contractor fees",
  materials: "Materials",
  interior_design: "Interior design",
  property_management: "Property management",
};

export const EXPENSE_SUBGROUP_LABELS: Record<ExpenseSubgroup, string> = {
  labor: "Labor",
  construction: "Construction materials",
  furniture: "Furniture",
  online_marketplace: "Online marketplace",
  appliances: "Appliances (AC / Best Buy)",
  other: "Other",
  lulu: "Lulu (1R only)",
  monthly_mgmt: "Monthly management",
  hosting_fees: "Hosting fees",
};

export const RENO_TOTALS = {
  materialsPool: MATERIALS_POOL,
  contractor:
    CONTRACTOR_BY_UNIT["1L"] +
    CONTRACTOR_BY_UNIT["1R"] +
    CONTRACTOR_BY_UNIT["2R"] +
    CONTRACTOR_BY_UNIT.basement +
    WINDOWS_2R_ISRAEL,
  interiorDesign: INTERIOR_DESIGN_1R_LULU,
  get grandReno() {
    return round2(this.materialsPool + this.contractor + this.interiorDesign);
  },
};
