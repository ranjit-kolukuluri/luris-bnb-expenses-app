import { SEED_TRANSACTIONS, SEED_UNITS, SEED_PROPERTY } from "../src/lib/seed";
import { buildMonthlyOps } from "../src/lib/monthly-ops";

const income = SEED_TRANSACTIONS.filter((t) => t.type === "income");
console.log("income count", income.length);
for (const t of income) {
  console.log(t.occurred_on, t.unit_id, t.amount, t.title.slice(0, 40));
}

const rows = buildMonthlyOps({
  transactions: SEED_TRANSACTIONS,
  units: SEED_UNITS,
  purchaseDate: SEED_PROPERTY.purchase_date,
  mortgageFallback: SEED_PROPERTY.monthly_mortgage_total,
  asOf: new Date("2026-07-26T12:00:00"),
  futureMonths: 3,
});
for (const r of rows) {
  console.log(
    r.key,
    r.kind,
    "total",
    r.incomeTotal,
    "|",
    r.incomeByUnit.map((u) => u.code + ":" + u.amount).join(" ")
  );
}
