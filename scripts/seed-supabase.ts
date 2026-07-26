/**
 * Seed Supabase from local SEED_* data (service role).
 * Usage: npx tsx scripts/seed-supabase.ts
 */
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  SEED_CATEGORIES,
  SEED_PROPERTY,
  SEED_TRANSACTIONS,
  SEED_UNITS,
} from "../src/lib/seed";

function stableUuid(key: string): string {
  const hash = createHash("sha1").update(`luris-bnb:${key}`).digest();
  const bytes = Buffer.from(hash);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function loadEnvLocal() {
  try {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const raw = fs.readFileSync(
      path.join(process.cwd(), ".env.local"),
      "utf8"
    );
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([^#=]+)=(.*)$/.exec(line.trim());
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const propertyId = stableUuid(SEED_PROPERTY.id);
  const unitId = (codeOrId: string) => stableUuid(codeOrId);
  const catId = (id: string) => stableUuid(id);
  const txId = (id: string) => stableUuid(id);

  console.log("Upserting property…");
  const { error: propErr } = await sb.from("properties").upsert({
    id: propertyId,
    name: SEED_PROPERTY.name,
    address_line: SEED_PROPERTY.address_line,
    city: SEED_PROPERTY.city,
    state: SEED_PROPERTY.state,
    zip: SEED_PROPERTY.zip,
    purchase_date: SEED_PROPERTY.purchase_date,
    sale_price: SEED_PROPERTY.sale_price,
    loan_amount: SEED_PROPERTY.loan_amount,
    interest_rate: SEED_PROPERTY.interest_rate,
    monthly_pi: SEED_PROPERTY.monthly_pi,
    monthly_mi: SEED_PROPERTY.monthly_mi,
    monthly_escrow: SEED_PROPERTY.monthly_escrow,
    monthly_mortgage_total: SEED_PROPERTY.monthly_mortgage_total,
  });
  if (propErr) throw propErr;

  console.log("Upserting units…");
  const { error: unitErr } = await sb.from("units").upsert(
    SEED_UNITS.map((u) => ({
      id: unitId(u.id),
      property_id: propertyId,
      code: u.code,
      label: u.label,
      beds: u.beds,
      baths: u.baths,
      rental_model: u.rental_model,
      status: u.status,
      expected_monthly_rent: u.expected_monthly_rent,
      sort_order: u.sort_order,
    }))
  );
  if (unitErr) throw unitErr;

  console.log("Upserting categories…");
  const { error: catErr } = await sb.from("categories").upsert(
    SEED_CATEGORIES.map((c) => ({
      id: catId(c.id),
      property_id: propertyId,
      name: c.name,
      kind: c.kind,
      cadence: c.cadence,
      sort_order: c.sort_order,
    }))
  );
  if (catErr) throw catErr;

  console.log(`Upserting ${SEED_TRANSACTIONS.length} transactions…`);
  const batchSize = 100;
  for (let i = 0; i < SEED_TRANSACTIONS.length; i += batchSize) {
    const slice = SEED_TRANSACTIONS.slice(i, i + batchSize).map((t) => ({
      id: txId(t.id),
      property_id: propertyId,
      unit_id: t.unit_id ? unitId(t.unit_id) : null,
      category_id: t.category_id ? catId(t.category_id) : null,
      type: t.type,
      cadence: t.cadence,
      title: t.title,
      description: t.description,
      amount: t.amount,
      occurred_on: t.occurred_on,
      applies_on: t.applies_on ?? null,
      payment_account: t.payment_account,
      vendor: t.vendor,
      expense_group: t.expense_group ?? null,
      expense_subgroup: t.expense_subgroup ?? null,
      is_seeded: true,
      deleted_at: null,
      import_source: t.import_source ?? "statement",
    }));
    const { error: txErr } = await sb.from("transactions").upsert(slice);
    if (txErr) throw txErr;
  }

  console.log("Done.");
  console.log(`Property id: ${propertyId}`);

  console.log("Upserting statement coverage…");
  const { STATEMENT_COVERAGE } = await import("../src/lib/seed");
  const { error: covErr } = await sb.from("statement_coverage").upsert(
    STATEMENT_COVERAGE.map((c) => ({
      property_id: propertyId,
      account: c.account,
      through_date: c.through,
      label: c.label,
    })),
    { onConflict: "property_id,account" }
  );
  if (covErr) console.warn("statement_coverage:", covErr.message);

  console.log(
    "Next: open the app, sign in, and claim the property (Settings → Cloud sync)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
